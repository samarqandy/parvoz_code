/* ============================================================
   Parvoz — tashqi xizmatlar sozlamalari
   ------------------------------------------------------------
   ID kiritilmasa, tegishli skript UMUMAN yuklanmaydi —
   ya'ni sayt tezligiga ham, maxfiylikka ham ta'sir qilmaydi.

   GA4_ID         — Google Analytics 4 (analytics.google.com):   "G-XXXXXXXXXX"
   GOOGLE_ADS_ID  — Google Ads konversiya identifikatori:         "AW-123456789"
   ADS_LABELS     — Google Ads konversiya yorliqlari (har bir "konversiya amali" uchun alohida).
                    Google Ads > Maqsadlar > Konversiyalar > Yangi konversiya amali > Veb-sayt >
                    "Qo'lda sozlash" > tegni o'rnatish: u "AW-123456789/AbCdEfGhIj" ko'rsatadi:
                    AW-... qismi GOOGLE_ADS_ID, "/" dan keyingisi — yorliq.
                      lead     — ariza formasi yuborildi (asosiy)
                      phone    — telefon raqami bosildi
                      telegram — Telegram havolasi bosildi
                      whatsapp — WhatsApp havolasi bosildi
                    Kiritilmagan yorliq — o'sha hodisa Google Ads'ga yuborilmaydi (GA4 ga baribir ketadi).
   META_PIXEL     — Meta (Instagram/Facebook) Pixel:             "1234567890123456"
   ============================================================ */
window.PARVOZ_CONFIG = {
  GA4_ID: '',
  GOOGLE_ADS_ID: '',
  ADS_LABELS: { lead: '', phone: '', telegram: '', whatsapp: '' },
  META_PIXEL: '',

  SUPABASE_URL: 'https://pthqtdcbphqixeuqkgwa.supabase.co',
  WHATSAPP: '998972344442',
  PHONE: '+998972344442',
  TELEGRAM: 'parvozcode',
};
