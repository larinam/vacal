from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from dataclasses import asdict
from fido2.server import Fido2Server
from fido2.webauthn import PublicKeyCredentialRpEntity, PublicKeyCredentialUserEntity, PublicKeyCredentialDescriptor, AttestedCredentialData
from fido2.utils import websafe_encode, websafe_decode
from ..model import User, WebAuthnCredential
from ..dependencies import create_access_token

router = APIRouter(prefix="/webauthn", tags=["WebAuthn"])

rp = PublicKeyCredentialRpEntity(name="Vacal", id="vacal")
server = Fido2Server(rp)

registration_state = {}
authentication_state = {}

class UsernameModel(BaseModel):
    username: str

class CredentialModel(BaseModel):
    id: str
    rawId: str
    response: dict
    type: str

class RegisterCompleteModel(BaseModel):
    username: str
    credential: CredentialModel

class AuthenticateCompleteModel(BaseModel):
    username: str
    credential: CredentialModel

@router.post("/register-options")
def register_options(data: UsernameModel):
    user = User.get_by_username(data.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user_entity = PublicKeyCredentialUserEntity(id=data.username.encode(), name=data.username, display_name=user.name)
    creds = [PublicKeyCredentialDescriptor(id=websafe_decode(c.credential_id), type="public-key")
             for c in WebAuthnCredential.objects(user=user)]
    opts, state = server.register_begin(user_entity, creds)
    registration_state[data.username] = state
    options = asdict(opts.public_key)
    options["challenge"] = websafe_encode(options["challenge"])
    options["user"]["id"] = websafe_encode(options["user"]["id"])
    for cred in options.get("exclude_credentials", []):
        cred["id"] = websafe_encode(cred["id"])
    return options

@router.post("/register")
def register_complete(data: RegisterCompleteModel):
    user = User.get_by_username(data.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    state = registration_state.pop(data.username, None)
    if not state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration not initiated")
    credential = server.register_complete(state, data.credential.dict())
    cred_data = credential.credential_data
    WebAuthnCredential(
        user=user,
        credential_id=websafe_encode(cred_data.credential_id).decode(),
        credential_data=bytes(cred_data),
        sign_count=credential.counter
    ).save()
    return {"status": "ok"}

@router.post("/authenticate-options")
def authenticate_options(data: UsernameModel):
    user = User.get_by_username(data.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    creds = [AttestedCredentialData(c.credential_data) for c in WebAuthnCredential.objects(user=user)]
    if not creds:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No credentials")
    opts, state = server.authenticate_begin(creds)
    authentication_state[data.username] = (state, creds, user)
    options = asdict(opts.public_key)
    options["challenge"] = websafe_encode(options["challenge"])
    for cred in options.get("allow_credentials", []):
        cred["id"] = websafe_encode(cred["id"])
    return options

@router.post("/authenticate")
def authenticate_complete(data: AuthenticateCompleteModel):
    entry = authentication_state.pop(data.username, None)
    if not entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authentication not initiated")
    state, creds, user = entry
    credential = server.authenticate_complete(state, creds, data.credential.dict())
    # update sign count
    db_cred = WebAuthnCredential.objects(user=user, credential_id=websafe_encode(credential.credential_id).decode()).first()
    if db_cred:
        db_cred.sign_count = credential.counter
        db_cred.save()
    token = create_access_token(data={"sub": user.auth_details.username})
    return {"access_token": token, "token_type": "bearer"}
