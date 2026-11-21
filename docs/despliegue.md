# Despliegue

Vercel, Render o Netlify solo se conectan a repositorios propios: no pueden acceder al repo de la organización `platanus-hack`. Para desplegar sin dejar de commitear aquí, el código se espeja en un repo personal.

1. Crea un repositorio en tu cuenta personal de GitHub.
2. Agrega los dos repos como destinos de push de `origin`, para que un solo `git push` actualice ambos:

   ```bash
   git remote set-url --add --push origin https://github.com/platanus-hack/platanus-hack-26-cl-team-27.git
   git remote set-url --add --push origin https://github.com/<tu-usuario>/<tu-repo>.git
   ```

3. Conecta el servicio de deploy a tu repo personal y despliega desde ahí.

Los commits quedan en el repo de la organización para el jurado, y el deploy corre desde el repo que controlas. La URL pública va en `deploy-url` de [`platanus-hack-project.jsonc`](../platanus-hack-project.jsonc).
