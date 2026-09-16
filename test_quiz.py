"""
Birim Testleri (Unit Tests for Quiz App)
========================================
Puanlama modülü, soru sanitizasyonu, oda yönetimi,
isim çakışması ve admin yetkilendirme kurallarını test eder.
"""

import pytest
from starlette.testclient import TestClient

from scoring import calculate_score
from questions import get_sample_questions, sanitize_question_for_client
from room_manager import RoomManager, Room
from main import app


def test_scoring_wrong_answer():
    """Yanlış cevap durumunda süre ne olursa olsun 0 puan verilmelidir."""
    assert calculate_score(is_correct=False, elapsed_seconds=1.0, time_limit=15) == 0
    assert calculate_score(is_correct=False, elapsed_seconds=0.0, time_limit=15) == 0
    assert calculate_score(is_correct=False, elapsed_seconds=14.9, time_limit=15) == 0


def test_scoring_instant_correct_answer():
    """Sorunun hemen başında verilen doğru cevap maksimum taban + hız bonusu (1000 puan) almalıdır."""
    score = calculate_score(is_correct=True, elapsed_seconds=0.0, time_limit=15)
    assert score == 1000


def test_scoring_halfway_correct_answer():
    """Sürenin yarısında verilen doğru cevap yaklaşık 750 puan almalıdır."""
    score = calculate_score(is_correct=True, elapsed_seconds=7.5, time_limit=15)
    assert score == 750


def test_scoring_last_second_correct_answer():
    """Sürenin sonunda verilen doğru cevap en az taban puan (500) almalıdır."""
    score = calculate_score(is_correct=True, elapsed_seconds=15.0, time_limit=15)
    assert score == 500


def test_scoring_edge_cases():
    """Negatif süre veya süre aşımı durumlarında çökmeme ve güvenli puan testi."""
    assert calculate_score(is_correct=True, elapsed_seconds=-2.0, time_limit=15) == 1000
    assert calculate_score(is_correct=True, elapsed_seconds=20.0, time_limit=15) == 500


def test_sanitize_question():
    """İstemciye gönderilen soruda correct_option alanı bulunmamalıdır!"""
    questions = get_sample_questions()
    for q in questions:
        safe_q = sanitize_question_for_client(q)
        assert "correct_option" not in safe_q
        assert "id" in safe_q
        assert "text" in safe_q
        assert "options" in safe_q
        assert "time_limit" in safe_q
        assert len(safe_q["options"]) == 4


def test_room_creation_and_uniqueness():
    """Oda kodu üretimi 6 haneli ve benzersiz olmalıdır."""
    mgr = RoomManager()
    room1 = mgr.create_room("host_1", "HostAli")
    room2 = mgr.create_room("host_2", "HostVeli")

    assert len(room1.code) == 6
    assert len(room2.code) == 6
    assert room1.code != room2.code
    assert mgr.get_room(room1.code) is room1
    assert mgr.get_room(room1.code.lower()) is room1  # Case-insensitive


def test_room_name_collision():
    """Aynı odada aynı isimli ikinci bir oyuncunun katılması engellenmelidir."""
    mgr = RoomManager()
    room = mgr.create_room("host_1", "Ahmet")

    assert room.check_name_exists("Ahmet") is True
    assert room.check_name_exists("ahmet") is True  # Büyük-küçük harf duyarsız
    assert room.check_name_exists("Mehmet") is False

    room.add_player("player_2", "Mehmet")
    assert room.check_name_exists("Mehmet") is True


def test_admin_authorization_required():
    """Normal kullanıcıların izinsiz oda açması engellenmeli, yalnızca admin açabilmelidir."""
    client = TestClient(app)

    # 1. Yanlış şifre ile deneme
    res_wrong = client.post("/api/rooms", json={"host_name": "Korsan", "admin_key": "yanlis_sifre"})
    assert res_wrong.status_code == 403

    # 2. Şifresiz veya boş şifre ile deneme
    res_empty = client.post("/api/rooms", json={"host_name": "Korsan", "admin_key": ""})
    assert res_empty.status_code == 403

    # 3. Doğru admin şifresi ile deneme
    res_correct = client.post("/api/rooms", json={"host_name": "AdminAli", "admin_key": "admin123"})
    assert res_correct.status_code == 200
    data = res_correct.json()
    assert data["success"] is True
    assert len(data["room_code"]) == 6
    assert data["is_host"] is True

    # 4. Admin verify endpoint testi
    assert client.post("/api/admin/verify", json={"admin_key": "admin123"}).status_code == 200
    assert client.post("/api/admin/verify", json={"admin_key": "hatali"}).status_code == 403


@pytest.mark.asyncio
async def test_room_game_cycle_and_scoring():
    """Oyun başlatma, cevap gönderme ve puan tablosu testi."""
    mgr = RoomManager()
    room = mgr.create_room("host_1", "Host")
    p1 = room.add_player("p1", "Bera")
    p2 = room.add_player("p2", "Ahmet")

    await room.start_game()
    assert room.status == "question"
    assert room.current_question_index == 0

    current_q = room.questions[0]
    correct_opt = current_q["correct_option"]
    wrong_opt = "A" if correct_opt != "A" else "B"

    # Bera doğru cevap veriyor
    await room.handle_submit_answer("p1", correct_opt)
    # Ahmet yanlış cevap veriyor
    await room.handle_submit_answer("p2", wrong_opt)

    assert p1.score > 0
    assert p2.score == 0

    leaderboard = room.get_leaderboard()
    assert leaderboard[0]["id"] == "p1"
    assert leaderboard[0]["name"] == "Bera"


if __name__ == "__main__":
    import pytest
    pytest.main(["-v", __file__])
