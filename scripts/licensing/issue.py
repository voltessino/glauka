#!/usr/bin/env python3
"""Offline license issuer. Keep its directory OUTSIDE Git and delivery archives.
Requires Python cryptography. Never prints the private key or activation token.
"""
import argparse, base64, json, os, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def outside_checkout(source: Path) -> Path:
    """Never write issuer private material or bearer license grants into Git."""
    resolved = source.expanduser().resolve()
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError("License keys and activation grants must be written outside the repository checkout")
    return resolved


def b64(data): return base64.urlsafe_b64encode(data).decode().rstrip('=')
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--issuer-dir',type=Path,required=True)
    p.add_argument('--kind',choices=['pro','owner'],required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--days',type=int,default=365)
    args=p.parse_args()
    try:
        args.issuer_dir=outside_checkout(args.issuer_dir)
        args.output=outside_checkout(args.output)
    except ValueError as error:
        p.error(str(error))
    if args.days<1 or args.days>36500: p.error('days must be 1..36500')
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    args.issuer_dir.mkdir(parents=True,exist_ok=True,mode=0o700)
    os.chmod(args.issuer_dir,0o700)
    keypath=args.issuer_dir/(args.kind+'.pem')
    if keypath.exists(): key=serialization.load_pem_private_key(keypath.read_bytes(),password=None)
    else:
        key=ec.generate_private_key(ec.SECP256R1())
        with keypath.open('xb') as f:
            os.chmod(keypath,0o600)
            f.write(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    public=key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)
    (args.issuer_dir/(args.kind+'.public')).write_text(base64.b64encode(public).decode())
    now=int(time.time())
    payload=b64(json.dumps(dict(v=1,aud='glauka',kind=args.kind,id=str(uuid.uuid4()),iat=now,exp=now+args.days*86400),separators=(',',':')).encode())
    message=('GLK1.'+payload).encode()
    signature=key.sign(message,ec.ECDSA(hashes.SHA256()))
    with args.output.open('x') as f:
        os.chmod(args.output,0o600)
        f.write(message.decode()+'.'+b64(signature)+'\n')
    print('Activation written to private output; issuer public key in '+str(args.issuer_dir/(args.kind+'.public')))
if __name__=='__main__': main()
