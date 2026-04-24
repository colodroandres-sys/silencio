# Setup: Usuario de Test para Tests de Generación

## Qué necesitas hacer una vez

Los tests en `tests/generation.spec.js` usan una cuenta real que debe tener créditos ilimitados para no agotarse con los tests automáticos.

---

## Paso 1: Crear o designar el usuario de test

**Opción A — Usar una cuenta existente** (más rápido):
Usa la cuenta de Gmail de prueba creada en la sesión 9 de QA.

**Opción B — Crear cuenta nueva**:
1. Abre stillova.com en incógnito
2. Regístrate con un email nuevo (ej. `test@stillova.com` si tienes control de ese dominio, o un Gmail nuevo)
3. Completa el onboarding

---

## Paso 2: Asignar plan Studio en Supabase

El usuario de test necesita el plan `studio` (60 créditos/mes) para que los tests automáticos no fallen por falta de créditos.

1. Ve al dashboard de Supabase → **Table Editor** → tabla `users`
2. Busca el `clerk_id` del usuario de test
3. Actualiza `plan = 'studio'` y `subscription_status = 'active'`

También puedes hacerlo con SQL:
```sql
UPDATE users 
SET plan = 'studio', subscription_status = 'active'
WHERE clerk_id = 'user_XXXXXXXXX';  -- reemplaza con el clerk_id real
```

---

## Paso 3: Capturar la sesión

```bash
node tests/setup-auth.js
```

Se abrirá un navegador. Inicia sesión con la cuenta de test. El script detecta la pantalla home y guarda la sesión en `tests/.auth/test-user.json`.

**La sesión dura varios días.** Solo necesitas repetir este paso si los tests dan error 401.

---

## Paso 4: Ejecutar los tests

```bash
# Solo tests de generación (con APIs reales)
npx playwright test tests/generation.spec.js

# Ver el navegador mientras corren
npx playwright test tests/generation.spec.js --headed

# Solo el test P0 (más rápido, no gasta audio)
npx playwright test tests/generation.spec.js --grep "P0"
```

---

## Créditos que gastan los tests

| Test | Créditos |
|------|----------|
| Test 1: /api/meditation | 0 (texto solo, no audio) |
| Test 2: /api/audio | 1 (5 min) |
| Test 3: E2E completo | 1 (5 min) |

**Por ejecución completa: 2 créditos.** Con studio (60/mes) → 30 ejecuciones completas al mes.
