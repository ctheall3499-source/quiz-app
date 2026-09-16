"""
FastAPI Ana Uygulaması (Main Server Entry Point)
==============================================
Bu dosya HTTP endpoint'lerini, WebSocket bağlantılarını ve statik web
dosyalarının sunumunu yönetir.
"""

import os
import uuid
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from room_manager import room_manager

app = FastAPI(title="Kahoot Benzeri Real-Time Quiz Web Sitesi", version="1.0.0")

# CORS yapılandırması
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Statik dosya dizini
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


# Pydantic Modelleri
class CreateRoomRequest(BaseModel):
    host_name: str
    admin_key: str


class AdminVerifyRequest(BaseModel):
    admin_key: str


class JoinCheckRequest(BaseModel):
    room_code: str
    player_name: str


@app.get("/")
@app.get("/admin")
async def get_index():
    """Ana SPA HTML dosyasını sunar."""
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html bulunamadı.")
    return FileResponse(str(index_file))


@app.post("/api/admin/verify")
async def verify_admin(req: AdminVerifyRequest):
    """Admin şifresini doğrular."""
    if req.admin_key.strip() != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Geçersiz yönetici şifresi.")
    return {"success": True}


@app.post("/api/rooms")
async def create_room(req: CreateRoomRequest):
    """Yeni bir oyun odası oluşturur. Sadece yetkili admin çağırabilir."""
    if req.admin_key.strip() != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=403,
            detail="Yetkisiz erişim: Yalnızca admin kullanıcılar yeni oda oluşturabilir."
        )

    host_name = req.host_name.strip()
    if not host_name:
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir kullanıcı adı girin.")

    host_id = f"host_{uuid.uuid4().hex[:8]}"
    room = room_manager.create_room(host_id=host_id, host_name=host_name)

    return {
        "success": True,
        "room_code": room.code,
        "player_id": host_id,
        "player_name": host_name,
        "is_host": True
    }


@app.post("/api/join-check")
async def check_join_room(req: JoinCheckRequest):
    """
    Odaya katılmadan önce oda kodunun geçerliliğini ve
    oyuncu adının çakışıp çakışmadığını doğrular.
    """
    room_code = req.room_code.strip().upper()
    player_name = req.player_name.strip()

    if not room_code:
        return {"success": False, "message": "Lütfen 6 haneli oda kodunu girin."}
    if not player_name:
        return {"success": False, "message": "Lütfen oyuncu adınızı girin."}

    room = room_manager.get_room(room_code)
    if not room:
        return {"success": False, "message": f"'{room_code}' kodlu bir oda bulunamadı. Lütfen kontrol edin."}

    if room.status != "lobby":
        return {"success": False, "message": "Bu odada oyun zaten başlamış durumda. Lobiye yeni oyuncu alınamaz."}

    if room.check_name_exists(player_name):
        return {
            "success": False,
            "message": f"'{player_name}' ismi bu odada zaten kullanılıyor. Lütfen farklı bir isim seçin."
        }

    # Yeni oyuncu için benzersiz ID oluştur
    player_id = f"player_{uuid.uuid4().hex[:8]}"

    return {
        "success": True,
        "room_code": room.code,
        "player_id": player_id,
        "player_name": player_name,
        "is_host": False
    }


@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    """
    Tüm gerçek zamanlı oyun etkileşimlerini yöneten WebSocket bağlantı noktası.
    """
    await websocket.accept()

    clean_code = room_code.strip().upper()
    room = room_manager.get_room(clean_code)

    if not room:
        await websocket.send_json({
            "type": "error",
            "message": "Oda bulunamadı veya kapatılmış."
        })
        await websocket.close()
        return

    player = room.get_player(player_id)
    
    # Eğer oyuncu henüz odada kayıtlı değilse URL query'den veya ilk mesajdan isim alınabilir
    # Ancak REST /api/join-check üzerinden isim kaydedilmişse direkt bağlanır
    if not player:
        # İsim parametresi query'de var mı?
        player_name = websocket.query_params.get("name", "Oyuncu")
        is_host = (player_id == room.host_id)
        player = room.add_player(player_id, player_name, is_host=is_host)
    else:
        player.is_connected = True

    player.websocket = websocket

    # Bağlantı kurulunca oyuncuya mevcut durumu ve rolünü bildir
    await websocket.send_json({
        "type": "connected",
        "room_code": room.code,
        "player_id": player.id,
        "player_name": player.name,
        "is_host": player.is_host,
        "room_status": room.status
    })

    # Lobiye katılan herkesi haberdar et
    await room.broadcast_player_list()

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            # 1. Host oyunu başlatıyor
            if action == "start_game":
                if player.is_host:
                    await room.start_game()
                else:
                    await websocket.send_json({"type": "error", "message": "Sadece host oyunu başlatabilir!"})

            # 2. Oyuncu cevap gönderiyor
            elif action == "submit_answer":
                option_id = data.get("option")
                if option_id:
                    await room.handle_submit_answer(player.id, str(option_id))

            # 3. Host sonraki soruya geçiyor
            elif action == "next_question":
                if player.is_host:
                    await room.next_question()

            # 4. Host oyunu lobiye sıfırlıyor
            elif action == "reset_to_lobby":
                if player.is_host:
                    await room.reset_to_lobby()

    except WebSocketDisconnect:
        player.is_connected = False
        player.websocket = None
        # Oyuncu ayrıldığında lobi listesini güncelle
        if room.status == "lobby":
            await room.broadcast_player_list()
    except Exception as e:
        player.is_connected = False
        player.websocket = None


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Quiz Web Uygulaması Başlatılıyor...")
    print("📍 URL: http://localhost:8000")
    print("📱 Aynı yerel ağdaki telefon/tabletler için: http://<BILGISAYAR_IP>:8000")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
