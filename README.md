# Serialport WebSocket

Biblioteca que permite gerenciar portas seriais através do browser via websocket

## Instalando

Abra o terminal, e na pasta raíz do script, execute:

```
npm i @libs-scripts-mep/serialport-websocket
```

## Desinstalando

Abra o terminal, e na pasta raíz do script, execute:

```
npm uninstall @libs-scripts-mep/serialport-websocket
```

## Atualizando

Abra o terminal, e na pasta raíz do script, execute:

```
npm update @libs-scripts-mep/serialport-websocket
```

## Como utilizar

Realize a importação:

```js
import Socket from "./module_path/client.js"
```
As demais informações e instruções estarão disponíveis via `JSDocs`.

> # ⚠️ 
> O servidor será gerenciado automaticamente ao importar o client (`Socket`)
> 
> Para que o server não seja derrubado desnecessariamente, é recomendado que os comandos `location.reload()` do seu script, seja precedido do comando `window.onbeforeunload = () => { }`, exemplo:
> ```js 
> function reload() {
>   window.onbeforeunload = () => { }
>   location.reload()
>}
> ```

