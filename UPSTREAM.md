# Frontend provenance

Based on the official [RuoYi-Vue3](https://github.com/yangzongzhuan/RuoYi-Vue3) repository.

- Upstream commit: `a88e86e8ec10dbd82832cb5d94df2616a2301705`
- Upstream version: `3.9.2`
- The original MIT license and copyright notice are retained in `LICENSE`.
- Original upstream README is retained in `README.upstream.md`.

Local changes add warehouse pages, bilingual warehouse/navigation/login text,
and Java `/warehouse` API integration through the official Axios/JWT client.
The Vite development proxy points to `http://127.0.0.1:18080`.
The previous Node application is not used as a backend or embedded in an iframe.

Business capabilities are supplied by the Java service. An unimplemented
operation is shown as unavailable; no simulated successful writes are used.

The unused upstream password-cookie encryption example was removed, including
its bundled demonstration RSA key. Login remembers only the username; it does
not persist or locally encrypt the password.
