import os, sys, json, hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
src, pwd, outdir, asof = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
data=open(src,'rb').read(); salt=os.urandom(16); iv=os.urandom(12)
key=PBKDF2HMAC(algorithm=hashes.SHA256(),length=32,salt=salt,iterations=200000).derive(pwd.encode())
blob=b'OKK1'+salt+iv+AESGCM(key).encrypt(iv,data,None)
open(os.path.join(outdir,'data.okk'),'wb').write(blob)
json.dump({'id':hashlib.sha256(blob).hexdigest()[:16],'asof':asof},open(os.path.join(outdir,'version.json'),'w'))
print(len(blob))
