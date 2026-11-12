# Groove Player Online — catálogo compartido

Versión web del reproductor Electron original. Los archivos de audio se guardan en Supabase Storage y los metadatos en Supabase Database. Cualquier visitante puede escuchar el catálogo y las playlists; solo una cuenta autorizada como administradora puede subir o borrar canciones.

## Archivos
- `index.html`, `styles.css`, `app.js`: aplicación web responsive.
- `config.js`: URL y clave pública de Supabase.
- `supabase-setup.sql`: tablas, bucket y reglas de seguridad.

## 1. Crear el backend Supabase
1. Crea un proyecto en https://supabase.com/.
2. Abre **SQL Editor**, crea una consulta y pega el contenido de `supabase-setup.sql`. Ejecútalo.
3. En **Project Settings → API** copia Project URL y la publishable key (o anon public key).
4. Abre `config.js` y reemplaza `TU-PROYECTO` y `TU-PUBLISHABLE-O-ANON-KEY` por esos valores.
5. En **Authentication → Users**, crea un usuario con tu correo y una contraseña segura.
6. Copia el UUID de ese usuario. En SQL Editor ejecuta el INSERT comentado al final de `supabase-setup.sql`, sustituyendo el texto por el UUID real. Esto autoriza esa cuenta como administradora.
7. Para producción, configura los proveedores y URLs permitidas en Authentication según el dominio que publiques.

La clave `anon`/publishable es pública y está diseñada para usarse en el navegador con RLS. Nunca incluyas una `service_role` o secret key en `config.js` ni en GitHub.

## 2. Publicar en GitHub Pages
1. Crea un repositorio en GitHub, por ejemplo `groove-player-online`.
2. Sube el contenido de esta carpeta a la raíz del repositorio. Debe quedar `index.html` en la raíz.
3. En el repositorio entra a **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta `/(root)`, y pulsa **Save**.
6. Espera a que GitHub publique el sitio; la dirección aparecerá en esa misma sección.

## 3. Cómo funciona
- El público entra al enlace y puede escuchar todo el catálogo y elegir playlists compartidas.
- En **Administrar**, inicia sesión con el usuario autorizado.
- Escribe un nombre de playlist y selecciona uno o varios audios para subirlos.
- Las canciones nuevas aparecen para todos después de actualizar el catálogo.
- Los modos de reproducción son: sin repetición, repetir canción y repetir playlist.
- Atajos: espacio = reproducir/pausar; flechas izquierda/derecha = retroceder/avanzar 5 segundos.

## Límites y recomendaciones
- El SQL configura un máximo de 50 MB por archivo en el bucket. Ajusta el límite según tu plan y las necesidades de audio.
- El almacenamiento y el tráfico de reproducción consumen cuota del proyecto Supabase. Para una biblioteca grande o muchos oyentes, revisa precios y límites antes de publicar.
- GitHub Pages publica los archivos de la web, no almacena los audios. Los audios están en Supabase.
- Sube únicamente música de la que tengas derechos o autorización para distribuir/compartir.
