"""
Soru Havuzu Modülü (Question Bank Module)
=========================================
Bu modül, yarışmada sorulacak soruları ve bu soruların seçeneklerini,
doğru cevabını ve süre limitini barındırır.

İleride host'un kendi sorularını oluşturabilmesi için veri yapısı
tamamen standartlaştırılmıştır ve yeni sorular kolayca eklenebilir.
"""

from typing import List, Dict, Any
import copy

DEFAULT_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "text": "Dünyanın Güneş etrafında dönmesi yaklaşık ne kadar sürer?",
        "options": [
            {"id": "A", "text": "24 saat"},
            {"id": "B", "text": "7 gün"},
            {"id": "C", "text": "365 gün"},
            {"id": "D", "text": "30 gün"}
        ],
        "correct_option": "C",
        "time_limit": 15
    },
    {
        "id": 2,
        "text": "Türkiye Cumhuriyeti hangi yıl ilan edilmiştir?",
        "options": [
            {"id": "A", "text": "1919"},
            {"id": "B", "text": "1920"},
            {"id": "C", "text": "1923"},
            {"id": "D", "text": "1924"}
        ],
        "correct_option": "C",
        "time_limit": 15
    },
    {
        "id": 3,
        "text": "Güneş sistemindeki en büyük gezegen hangisidir?",
        "options": [
            {"id": "A", "text": "Mars"},
            {"id": "B", "text": "Satürn"},
            {"id": "C", "text": "Jüpiter"},
            {"id": "D", "text": "Venüs"}
        ],
        "correct_option": "C",
        "time_limit": 15
    },
    {
        "id": 4,
        "text": "Hangi elementin periyodik tablodaki kimyasal simgesi 'Au'dur?",
        "options": [
            {"id": "A", "text": "Gümüş"},
            {"id": "B", "text": "Bakır"},
            {"id": "C", "text": "Demir"},
            {"id": "D", "text": "Altın"}
        ],
        "correct_option": "D",
        "time_limit": 15
    },
    {
        "id": 5,
        "text": "Dünyanın bilinen en derin noktası olan Mariana Çukuru hangi okyanustadır?",
        "options": [
            {"id": "A", "text": "Büyük Okyanus (Pasifik)"},
            {"id": "B", "text": "Atlas Okyanusu"},
            {"id": "C", "text": "Hint Okyanusu"},
            {"id": "D", "text": "Kuzey Buz Denizi"}
        ],
        "correct_option": "A",
        "time_limit": 15
    }
]

def get_sample_questions() -> List[Dict[str, Any]]:
    """Varsayılan soruların bağımsız bir kopyasını döner."""
    return copy.deepcopy(DEFAULT_QUESTIONS)

def sanitize_question_for_client(question: Dict[str, Any]) -> Dict[str, Any]:
    """
    Soru ekranında oyunculara gönderilecek veriyi hazırlar.
    GÜVENLİK: 'correct_option' alanı temizlenerek istemcilerin doğru cevabı
    önceden görmesi kesinlikle engellenir.
    """
    return {
        "id": question["id"],
        "text": question["text"],
        "options": question["options"],
        "time_limit": question["time_limit"]
    }
