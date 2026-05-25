from datetime import datetime

from config import settings
from logging_config import get_logger

logger = get_logger(__name__)


def _send_reset_email(to_email: str, token: str, first_name: str = "") -> bool:
    if not settings.resend_api_key:
        logger.error("RESEND_API_KEY is not configured - cannot send reset email")
        return False
    try:
        import resend
    except ImportError:
        logger.error("resend package is not installed - cannot send reset email")
        return False

    resend.api_key = settings.resend_api_key
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    greeting = f"Привіт, {first_name}!" if first_name else "Привіт!"

    html_body = f"""
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Скидання пароля - BuildShop</title>
</head>
<body style="margin:0;padding:0;background:#f1ebe1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0f172a;padding:28px 40px;">
              <span style="font-size:22px;font-weight:900;letter-spacing:0.2em;color:#fbbf24;">BUILDSHOP</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#0f172a;">Скидання пароля</h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">{greeting}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#475569;">
                Ми отримали запит на скидання пароля для вашого акаунту <strong>{to_email}</strong>.
                Натисніть кнопку нижче, щоб встановити новий пароль.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="{reset_url}"
                       style="display:inline-block;background:#0f172a;color:#fbbf24;text-decoration:none;
                              padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;
                              letter-spacing:0.02em;">
                      Скинути пароль
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                Якщо кнопка не працює, скопіюйте це посилання у браузер:<br>
                <a href="{reset_url}" style="color:#d97706;word-break:break-all;">{reset_url}</a>
              </p>
              <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                Посилання дійсне протягом <strong>{settings.password_reset_ttl_minutes} хвилин</strong>.
                Якщо ви не надсилали цей запит, просто проігноруйте лист. Ваш пароль не зміниться.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                © {datetime.utcnow().year} BuildShop - будівельні матеріали онлайн
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    text_body = (
        f"{greeting}\n\n"
        f"Ми отримали запит на скидання пароля для {to_email}.\n\n"
        f"Перейдіть за посиланням (дійсне {settings.password_reset_ttl_minutes} хв):\n{reset_url}\n\n"
        "Якщо ви не надсилали цей запит, просто проігноруйте цей лист.\n\n"
        "- Команда BuildShop"
    )

    try:
        params = {
            "from": settings.resend_from_email,
            "to": [to_email],
            "subject": "Скидання пароля - BuildShop",
            "html": html_body,
            "text": text_body,
        }
        result = resend.Emails.send(params)
        logger.info(
            "Password reset email sent",
            extra={"resend_id": result.get("id"), "to": to_email},
        )
        return True
    except Exception as exc:
        logger.error(
            "Failed to send password reset email via Resend",
            extra={"error": str(exc), "to": to_email},
        )
        return False
