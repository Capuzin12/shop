from pydantic import BaseModel, EmailStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None

