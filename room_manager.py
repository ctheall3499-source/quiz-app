"""
Oda ve Oyun Yönetimi Modülü (Room & Game Manager)
================================================
Bu modül, odaların oluşturulması, oyuncuların bağlanması/ayrılması,
gerçek zamanlı oyun döngüsü, sunucu tabanlı zamanlayıcılar ve
güvenli puanlama mantığını yönetir.
"""

import asyncio
import random
import string
import time
from typing import Dict, List, Optional, Any
from fastapi import WebSocket

from questions import get_sample_questions, sanitize_question_for_client
from scoring import calculate_score


class Player:
    """Odadaki her bir oyuncunun durumunu temsil eder."""
    def __init__(self, player_id: str, name: str, is_host: bool = False):
        self.id = player_id
        self.name = name
        self.is_host = is_host
        self.score = 0
        self.last_round_score = 0
        self.last_answer: Optional[str] = None
        self.last_answer_time: Optional[float] = None
        self.is_connected = True
        self.websocket: Optional[WebSocket] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "is_host": self.is_host,
            "score": self.score,
            "last_round_score": self.last_round_score,
            "is_connected": self.is_connected
        }


class Room:
    """Bir quiz odasının tüm durumunu ve oyun döngüsünü yönetir."""
    def __init__(self, room_code: str, host_id: str, host_name: str):
        self.code = room_code
        self.host_id = host_id
        self.players: Dict[str, Player] = {}
        self.status = "lobby"  # "lobby", "question", "question_result", "finished"
        self.questions = get_sample_questions()
        self.current_question_index = 0
        self.question_start_time: Optional[float] = None
        self.timer_task: Optional[asyncio.Task] = None
        
        # Host'u oyuncu listesine de ekle
        self.add_player(host_id, host_name, is_host=True)

    def add_player(self, player_id: str, name: str, is_host: bool = False) -> Player:
        player = Player(player_id, name, is_host)
        self.players[player_id] = player
        return player

    def get_player(self, player_id: str) -> Optional[Player]:
        return self.players.get(player_id)

    def get_active_non_host_players(self) -> List[Player]:
        """Sadece soru çözen normal oyuncuları döner (Host oynamıyorsa)."""
        return [p for p in self.players.values() if p.is_connected and not p.is_host]

    def get_all_active_participants(self) -> List[Player]:
        """Puan alan tüm oyuncuları döner (Eğer host da oynuyorsa hepsi dahil)."""
        # Host sadece yönetici rolündedir; oyuncular yarışmacıdır.
        # Eğer odada sadece host varsa, test amaçlı host da yarışmacı sayılabilir.
        non_hosts = [p for p in self.players.values() if p.is_connected and not p.is_host]
        if non_hosts:
            return non_hosts
        return [p for p in self.players.values() if p.is_connected]

    def check_name_exists(self, name: str) -> bool:
        """Aynı isimde bağlı bir oyuncu var mı kontrol eder (Büyük/küçük harf duyarsız)."""
        clean_name = name.strip().lower()
        for p in self.players.values():
            if p.is_connected and p.name.strip().lower() == clean_name:
                return True
        return False

    def get_leaderboard(self) -> List[Dict[str, Any]]:
        """Oyuncuları puanlarına göre azalan sırada sıralar."""
        # Yarışmacıları sırala
        participants = self.get_all_active_participants()
        sorted_players = sorted(participants, key=lambda p: p.score, reverse=True)
        return [
            {
                "rank": idx + 1,
                "id": p.id,
                "name": p.name,
                "score": p.score,
                "last_round_score": p.last_round_score
            }
            for idx, p in enumerate(sorted_players)
        ]

    async def broadcast(self, message: Dict[str, Any]):
        """Odada WebSocket bağlantısı aktif olan herkese mesaj iletir."""
        disconnected_ids = []
        for player_id, player in self.players.items():
            if player.websocket and player.is_connected:
                try:
                    await player.websocket.send_json(message)
                except Exception:
                    disconnected_ids.append(player_id)

        for p_id in disconnected_ids:
            if p_id in self.players:
                self.players[p_id].is_connected = False

    async def broadcast_player_list(self):
        """Güncel oyuncu listesini lobiye yayınlar."""
        players_data = [p.to_dict() for p in self.players.values() if p.is_connected]
        await self.broadcast({
            "type": "player_list_update",
            "players": players_data,
            "total_players": len([p for p in self.players.values() if p.is_connected and not p.is_host])
        })

    async def start_game(self) -> bool:
        """Oyunu başlatır ve ilk soruyu gönderir."""
        if self.status != "lobby":
            return False
        
        self.status = "question"
        self.current_question_index = 0
        # Puanları sıfırla
        for p in self.players.values():
            p.score = 0
            p.last_round_score = 0
            p.last_answer = None

        await self.send_current_question()
        return True

    async def send_current_question(self):
        """Mevcut soruyu tüm oyunculara senkronize olarak başlatır."""
        if self.current_question_index >= len(self.questions):
            await self.finish_game()
            return

        current_q = self.questions[self.current_question_index]
        self.status = "question"
        self.question_start_time = time.monotonic()

        # Oyuncuların bu round cevaplarını sıfırla
        for p in self.players.values():
            p.last_answer = None
            p.last_answer_time = None
            p.last_round_score = 0

        # Güvenlik: Doğru cevap çıkarılmış soru verisi
        safe_q = sanitize_question_for_client(current_q)

        # Oyunculara soruyu bildir
        await self.broadcast({
            "type": "question_start",
            "question_index": self.current_question_index + 1,
            "total_questions": len(self.questions),
            "question": safe_q,
            "time_limit": current_q["time_limit"]
        })

        # Eski zamanlayıcı varsa iptal et ve yeni zamanlayıcı başlat
        if self.timer_task and not self.timer_task.done():
            self.timer_task.cancel()

        self.timer_task = asyncio.create_task(self._question_timer(current_q["time_limit"]))

    async def _question_timer(self, duration: int):
        """Soru süresi boyunca bekler ve süre bitince sonuç ekranına geçirir."""
        try:
            await asyncio.sleep(duration)
            # Süre doldu, henüz sonuç ekranına geçilmediyse sonuçlandır
            if self.status == "question":
                await self.end_question()
        except asyncio.CancelledError:
            # Tüm oyuncular erken cevap verdiğinde burası iptal edilir
            pass

    async def handle_submit_answer(self, player_id: str, option_id: str) -> bool:
        """Bir oyuncudan gelen cevabı güvenli şekilde kaydeder ve puanlar."""
        if self.status != "question":
            return False

        player = self.players.get(player_id)
        if not player or not player.is_connected:
            return False

        # Zaten cevap vermişse tekrar cevap veremez
        if player.last_answer is not None:
            return False

        current_q = self.questions[self.current_question_index]
        now = time.monotonic()
        elapsed = now - (self.question_start_time or now)

        player.last_answer = option_id
        player.last_answer_time = elapsed

        is_correct = (option_id.upper() == current_q["correct_option"].upper())
        round_score = calculate_score(
            is_correct=is_correct,
            elapsed_seconds=elapsed,
            time_limit=current_q["time_limit"]
        )

        player.last_round_score = round_score
        player.score += round_score

        # Oyuncuya cevabının kilitlendiğini bildir
        if player.websocket:
            try:
                await player.websocket.send_json({
                    "type": "answer_locked",
                    "selected_option": option_id
                })
            except Exception:
                pass

        # Kaç kişinin cevap verdiğini yayınla
        active_participants = self.get_all_active_participants()
        answered_count = sum(1 for p in active_participants if p.last_answer is not None)
        total_participants = len(active_participants)

        await self.broadcast({
            "type": "answer_count_update",
            "answered_count": answered_count,
            "total_participants": total_participants
        })

        # Eğer yarışan herkes cevap verdiyse süreyi beklemeden doğrudan sonucu göster
        if answered_count >= total_participants and total_participants > 0:
            if self.timer_task and not self.timer_task.done():
                self.timer_task.cancel()
            await self.end_question()

        return True

    async def end_question(self):
        """Soruyu sonlandırır, doğru cevabı açıklar ve round liderlik tablosunu yayınlar."""
        self.status = "question_result"
        current_q = self.questions[self.current_question_index]

        # Her oyuncunun bu sorudaki sonucu
        players_round_summary = []
        for p in self.get_all_active_participants():
            players_round_summary.append({
                "id": p.id,
                "name": p.name,
                "selected_option": p.last_answer,
                "is_correct": (p.last_answer == current_q["correct_option"]),
                "round_score": p.last_round_score,
                "total_score": p.score
            })

        leaderboard = self.get_leaderboard()

        await self.broadcast({
            "type": "question_result",
            "question_index": self.current_question_index + 1,
            "total_questions": len(self.questions),
            "correct_option": current_q["correct_option"],
            "players_summary": players_round_summary,
            "leaderboard": leaderboard,
            "is_last_question": (self.current_question_index + 1 >= len(self.questions))
        })

    async def next_question(self):
        """Host tarafından veya otomatik sayaç ile bir sonraki soruya geçer."""
        if self.status != "question_result":
            return
        
        self.current_question_index += 1
        if self.current_question_index >= len(self.questions):
            await self.finish_game()
        else:
            await self.send_current_question()

    async def finish_game(self):
        """Oyunu bitirir ve final podyumunu yayınlar."""
        self.status = "finished"
        leaderboard = self.get_leaderboard()
        winner = leaderboard[0] if leaderboard else None

        await self.broadcast({
            "type": "game_over",
            "leaderboard": leaderboard,
            "winner": winner
        })

    async def reset_to_lobby(self):
        """Oyunu yeniden başlatmak üzere lobiye döndürür."""
        self.status = "lobby"
        self.current_question_index = 0
        for p in self.players.values():
            p.score = 0
            p.last_round_score = 0
            p.last_answer = None
            p.last_answer_time = None

        await self.broadcast({
            "type": "returned_to_lobby"
        })
        await self.broadcast_player_list()


class RoomManager:
    """Tüm odaları hafızada yöneten merkezi servis."""
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def _generate_room_code(self) -> str:
        """6 karakterlik benzersiz, okunaklı oda kodu üretir (Örn: ABC123)."""
        # Karışıklık yaratabilecek harf/rakamlar hariç tutulmuştur (0, O, 1, I)
        chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        while True:
            code = "".join(random.choices(chars, k=6))
            if code not in self.rooms:
                return code

    def create_room(self, host_id: str, host_name: str) -> Room:
        """Yeni bir oda oluşturur ve host'u atar."""
        room_code = self._generate_room_code()
        room = Room(room_code, host_id, host_name)
        self.rooms[room_code] = room
        return room

    def get_room(self, room_code: str) -> Optional[Room]:
        """Oda koduna göre odayı getirir (Büyük/küçük harf duyarsız)."""
        if not room_code:
            return None
        return self.rooms.get(room_code.strip().upper())

    def remove_room(self, room_code: str):
        if room_code in self.rooms:
            del self.rooms[room_code]


# Global tekil (singleton) RoomManager nesnesi
room_manager = RoomManager()
