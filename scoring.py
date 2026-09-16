"""
Puanlama Sistemi Modülü (Scoring Module)
========================================
Bu modül, oyuncuların verdikleri cevaplara göre kazanacakları puanı
doğruluk ve hız faktörlerini birleştirerek hesaplar.

Mantık:
- Yanlış cevap veya cevap vermeme = 0 puan
- Doğru cevap = Temel Puan (Base Score) + Hız Bonusu (Speed Bonus)
- Soru süresi içinde ne kadar hızlı cevap verilirse, hız bonusu o kadar yüksek olur.
"""

def calculate_score(
    is_correct: bool,
    elapsed_seconds: float,
    time_limit: float,
    base_score: int = 500,
    max_speed_bonus: int = 500
) -> int:
    """
    Oyuncunun kazanacağı puanı hesaplar.
    
    :param is_correct: Cevabın doğruluğu (True/False)
    :param elapsed_seconds: Sorunun başladığı andan cevabın sunucuya ulaştığı ana kadar geçen saniye
    :param time_limit: Sorunun toplam geçerlilik süresi (saniye)
    :param base_score: Doğru cevap için verilen garanti taban puan (varsayılan: 500)
    :param max_speed_bonus: En hızlı cevap verildiğinde kazanılabilecek maksimum ek puan (varsayılan: 500)
    :return: Toplam kazanılan puan (0 ile base_score + max_speed_bonus arası)
    """
    if not is_correct:
        return 0

    # Süre sınırlarını güvenli aralığa al
    if time_limit <= 0:
        return base_score

    safe_elapsed = max(0.0, min(elapsed_seconds, float(time_limit)))
    
    # Kalan süre oranı: 0.0 (son an) ile 1.0 (ilk an) arası
    remaining_ratio = 1.0 - (safe_elapsed / float(time_limit))
    
    # Hız bonusu hesaplaması
    speed_bonus = int(round(max_speed_bonus * remaining_ratio))
    
    total_score = base_score + speed_bonus
    return total_score
