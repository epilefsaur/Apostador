# Apostador — Gerenciador de Bolões

SPA em HTML/CSS/JS puro conectada ao Supabase.

## 1. Configurar Supabase

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor** e cole todo o conteúdo de `sql/schema.sql`. Execute.
3. Vá em **Project Settings > API** e copie:
   - `Project URL`
   - `anon public key`
4. Cole esses valores em `js/supabase.js`.

## 2. Criar o primeiro admin

1. Abra o app e cadastre-se normalmente (vira usuário comum).
2. No Supabase, vá em **Table Editor > profiles** e localize seu registro.
3. Edite `is_admin` para `true`. **Salve.**
4. Faça logout e login novamente no app.
5. Agora você verá o menu **Admin**.

> Só é possível virar admin alterando `profiles.is_admin` direto no banco.
> O app nunca permite essa alteração.

## 3. Rodar localmente

Como é HTML/JS puro, basta servir os arquivos:

```bash
# Python
python -m http.server 5500

# ou Node
npx serve .