"""
End-to-End WebSocket Simülasyon Testi
====================================
Host ve 2 oyuncunun gerçek zamanlı lobi, soru, cevaplama,
puanlama ve oyun sonu akışını baştan sona simüle eder.
"""

from starlette.testclient import TestClient
from main import app, ADMIN_PASSWORD


def receive_until_type(ws, target_type, max_reads=10):
    """Hedef mesaj türü gelene kadar önceki ara mesajları tüketir."""
    for _ in range(max_reads):
        msg = ws.receive_json()
        if msg.get("type") == target_type:
            return msg
    raise AssertionError(f"'{target_type}' türünde mesaj {max_reads} okuma içinde bulunamadı!")


def test_full_game_e2e_simulation():
    client = TestClient(app)

    # 1. Host (Admin) yetkisiyle oda oluşturuyor
    res = client.post("/api/rooms", json={"host_name": "HostAdmin", "admin_key": ADMIN_PASSWORD})
    assert res.status_code == 200
    host_data = res.json()
    assert host_data["success"] is True
    room_code = host_data["room_code"]
    host_id = host_data["player_id"]

    # 2. İsim çakışması testi: Aynı isimle katılma denemesi
    res_collision = client.post("/api/join-check", json={
        "room_code": room_code,
        "player_name": "HostAdmin"
    })
    assert res_collision.status_code == 200
    assert res_collision.json()["success"] is False

    # 3. Oyuncu 1 (Bera) katılıyor
    res_p1 = client.post("/api/join-check", json={
        "room_code": room_code,
        "player_name": "Bera"
    })
    assert res_p1.status_code == 200
    p1_data = res_p1.json()
    assert p1_data["success"] is True
    p1_id = p1_data["player_id"]

    # 4. Oyuncu 2 (Ahmet) katılıyor
    res_p2 = client.post("/api/join-check", json={
        "room_code": room_code,
        "player_name": "Ahmet"
    })
    assert res_p2.status_code == 200
    p2_data = res_p2.json()
    assert p2_data["success"] is True
    p2_id = p2_data["player_id"]

    # 5. WebSocket bağlantılarını aç ve oyunu simüle et
    with client.websocket_connect(f"/ws/{room_code}/{host_id}?name=HostAdmin") as ws_host, \
         client.websocket_connect(f"/ws/{room_code}/{p1_id}?name=Bera") as ws_p1, \
         client.websocket_connect(f"/ws/{room_code}/{p2_id}?name=Ahmet") as ws_p2:

        # Bağlantı karşılama mesajlarını doğrula
        msg_h = receive_until_type(ws_host, "connected")
        assert msg_h["is_host"] is True

        msg_p1 = receive_until_type(ws_p1, "connected")
        assert msg_p1["is_host"] is False

        msg_p2 = receive_until_type(ws_p2, "connected")
        assert msg_p2["is_host"] is False

        # 6. Host oyunu başlatıyor
        ws_host.send_json({"action": "start_game"})

        # Tüm oyunculara soru 1 gelmeli
        q_host = receive_until_type(ws_host, "question_start")
        q_p1 = receive_until_type(ws_p1, "question_start")
        q_p2 = receive_until_type(ws_p2, "question_start")

        assert q_host["question_index"] == 1
        assert q_p1["question_index"] == 1
        assert q_p2["question_index"] == 1

        # GÜVENLİK TESTİ: Doğru cevap ('correct_option') istemciye gönderilmemelidir!
        assert "correct_option" not in q_p1["question"]
        assert "correct_option" not in q_p2["question"]
        assert "correct_option" not in q_host["question"]
        assert len(q_p1["question"]["options"]) == 4

        # 7. Bera doğru cevap (C: 365 gün) veriyor
        ws_p1.send_json({"action": "submit_answer", "option": "C"})
        ans_locked_p1 = receive_until_type(ws_p1, "answer_locked")
        assert ans_locked_p1["selected_option"] == "C"

        # 8. Ahmet yanlış cevap (A: 24 saat) veriyor
        ws_p2.send_json({"action": "submit_answer", "option": "A"})
        ans_locked_p2 = receive_until_type(ws_p2, "answer_locked")
        assert ans_locked_p2["selected_option"] == "A"

        # Herkes cevap verdiği için soru sonucu yayınlanır
        res_msg = receive_until_type(ws_p1, "question_result")
        assert res_msg["correct_option"] == "C"

        summary = {p["name"]: p for p in res_msg["players_summary"]}
        assert summary["Bera"]["is_correct"] is True
        assert summary["Bera"]["round_score"] >= 500  # Taban + hız bonusu
        assert summary["Ahmet"]["is_correct"] is False
        assert summary["Ahmet"]["round_score"] == 0

        # Liderlik tablosunda 1. Bera olmalıdır
        assert res_msg["leaderboard"][0]["name"] == "Bera"
        assert res_msg["leaderboard"][0]["rank"] == 1

    print("[OK] E2E WebSocket Cok Oyunculu Simulasyon Testi Basariyla Tamamlandi!")


if __name__ == "__main__":
    test_full_game_e2e_simulation()
