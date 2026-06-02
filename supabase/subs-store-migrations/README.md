# РњРёРіСЂР°С†РёРё РґР»СЏ Supabase Spotify Store (РїСЂРѕРµРєС‚ spotify)

Р­С‚Рё SQL **РЅРµ** РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ Рє GPT-РїСЂРѕРµРєС‚Сѓ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё. РЎРєРѕРїРёСЂСѓР№С‚Рµ С„Р°Р№Р» РІ **Supabase Dashboard в†’ SQL в†’ New query** РїСЂРѕРµРєС‚Р° Spotify Store Рё РІС‹РїРѕР»РЅРёС‚Рµ.

| Р¤Р°Р№Р» | РќР°Р·РЅР°С‡РµРЅРёРµ |
|------|------------|
| `001_role_audit.sql` | РђСѓРґРёС‚ СЃРјРµРЅС‹ СЂРѕР»РµР№ РІ Р°РґРјРёРЅРєРµ (`?site=subs-store`) |
| `002_profiles_telegram_username.sql` | РљРѕР»РѕРЅРєР° `profiles.telegram_username` РґР»СЏ Р°РґРјРёРЅРєРё Рё РїСЂРѕС„РёР»СЏ РєР»РёРµРЅС‚Р° |
| `003_discounts_promocodes_commerce.sql` | РўР°Р±Р»РёС†С‹ `discounts` / `promocodes` + `tariff_slugs` РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃ Р»РµРЅРґРёРЅРіРѕРј |

**РђРІС‚РѕРїСЂРѕРІРµСЂРєР°:** `npm run subs:db:telegram-username` вЂ” РїСЂРѕРІРµСЂРёС‚ РєРѕР»РѕРЅРєСѓ РІ Subs Supabase; РїСЂРё РЅР°Р»РёС‡РёРё `SUPABASE_ACCESS_TOKEN` РІ `.env.local` РїСЂРёРјРµРЅРёС‚ РјРёРіСЂР°С†РёСЋ СЃР°Рј, РёРЅР°С‡Рµ РІС‹РІРµРґРµС‚ SQL РґР»СЏ SQL Editor.

