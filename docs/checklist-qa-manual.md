# Checklist QA manual — Stillova pre-launch
Tiempo estimado: 15–20 min | Usa una pestaña de incógnito para todos los pasos

---

## PARTE 1 — Flujo guest (sin cuenta) · ~4 min

1. Abre stillova.com en una pestaña de incógnito
2. Debes ver el onboarding (pantalla de bienvenida con "Una meditación hecha para este momento exacto")
3. Pulsa **Empezar**
4. Elige 1 o más opciones de "¿Qué te trae aquí?" y pulsa **Continuar**
5. Verifica que la pantalla "Cómo funciona" aparece — pulsa **Continuar**
6. Verifica que la pantalla "Tu primera sesión — Una, gratis. Sin tarjeta." aparece
7. Pulsa **Empezar mi primera sesión**
8. Debes llegar a la pantalla Crear — el textarea debe estar **vacío** (placeholder "Hoy me siento…")
9. Escribe algo (ej: "me siento ansioso") — el botón "Componer meditación" debe activarse
10. Haz scroll hasta abajo — verifica que ves las pills de duración y el texto "elegir duración y voz requiere plan" sin que el botón verde los tape
11. ✅ / ❌ Anota si algo no se ve como debe

---

## PARTE 2 — Cuenta nueva (flujo free) · ~6 min

> Usa una cuenta de Gmail que NO hayas usado en Stillova antes.

12. Abre stillova.com en otra pestaña de incógnito (o cierra la anterior)
13. Completa el onboarding hasta el final y pulsa **Empezar mi primera sesión**
14. En la pantalla Crear, escribe algo en el textarea y pulsa **Componer meditación**
15. La meditación debe generarse (pantalla de carga ~30–60 seg) y reproducirse
16. Cuando termine, la app te ofrecerá guardarla o salir
17. Sal o guarda, y verás un mensaje para crear cuenta
18. Pulsa **Crear cuenta gratis** — debes poder registrarte con Google
19. Tras registrarte, vuelves al Home con tu cuenta activa (verás tu inicial en la esquina)
20. Pulsa **Crear meditación** desde el Home
21. Intenta generar una segunda meditación — debería aparecer el **paywall** diciendo que usaste tu meditación gratuita
22. ✅ El paywall debe mostrarse correctamente (verás los 3 planes: Essential, Premium, Studio)
23. Cierra el paywall pulsando la X — debe cerrarse sin freezar la pantalla
24. Cierra el paywall pulsando fuera del recuadro — mismo resultado
25. Pulsa Escape en teclado (si lo tienes) — el paywall debe cerrarse
26. Ve a **Biblioteca** (icono de libros en la barra inferior)
27. ✅ Debe verse el botón **"Crear cuenta gratis"** (no "Reintentar")

---

## PARTE 3 — Cuenta Premium existente · ~3 min

> Usa tu cuenta habitual de Andrés (ya tienes plan Premium).

28. Entra en stillova.com con tu cuenta normal (Google)
29. Ve a **Crear meditación**
30. ✅ Debes ver las pills de duración: 5, 10, 15, 20 min — todas activas (ninguna bloqueada)
31. ✅ Debes ver las opciones de voz: Femenina / Masculina — ambas activas
32. Elige 15 min y voz Masculina — genera la meditación
33. Verifica que el audio se genera y reproduce correctamente
34. Al terminar, guarda la meditación en biblioteca
35. Ve a **Biblioteca** — verifica que aparece la meditación guardada
36. ✅ Los filtros de emoción (Ansiedad, Dormir, Enfoque, Calma) deben funcionar al pulsarlos

---

## PARTE 4 — Pago con tarjeta real · ~5 min

> Usa la cuenta nueva del Paso 12–19 (plan Free). Tendrás que hacer un refund manual después.

37. Con la cuenta free, abre el paywall (intenta generar una segunda meditación)
38. Selecciona el plan **Essential** mensual
39. Pulsa **Empezar con Essential** — debe abrirse la página de pago de Stripe
40. ✅ La URL debe cambiar a checkout.stripe.com (nunca a una página de error)
41. Introduce los datos de tu tarjeta real
42. Completa el pago
43. ✅ Debes volver a Stillova y ver un mensaje de bienvenida a tu nuevo plan
44. Genera una meditación — debe funcionar sin paywall
45. Para verificar en Supabase: abre [Supabase](https://supabase.com) → proyecto Stillova → Table Editor → tabla `users` → busca el email de la cuenta nueva → verifica que el campo `plan` dice `essential`
46. Para cancelar/reembolsar: abre el [dashboard de Stripe](https://dashboard.stripe.com) → Payments → busca el cobro → pulsa Refund

---

## Criterio de ÉXITO

- Todos los pasos marcados ✅ funcionan correctamente
- No hay errores en consola (F12 → Console) salvo warnings menores de Clerk
- El audio se reproduce sin cortes y dura el tiempo seleccionado
- El paywall cierra correctamente por las 3 vías (X, backdrop, Escape)

## Criterio de FALLO — reportar inmediatamente si:

- El pago se cobra pero el plan no cambia en la app (bug crítico)
- La app se queda en pantalla de carga sin avanzar tras 90 segundos
- El paywall no cierra o bloquea la pantalla
- La biblioteca muestra "Reintentar" en lugar de "Crear cuenta gratis"
