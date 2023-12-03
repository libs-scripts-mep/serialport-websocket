import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { SerialPort } from 'serialport'

const http = createServer()
const io = new Server(http, { cors: { origin: "*" } })

try {
  io.on('connection', (socket) => {

    socket.on(SocketEvents.PORTLIST_REQ, async () => {
      console.log("portlist request")
      io.emit(SocketEvents.PORTLIST_RES, await SerialPortManager.portListUpdate())
    })

    socket.on(SocketEvents.OPEN_PORT_REQ, async (obj) => {
      console.log("open request", obj)
      if (obj.portInfo == undefined || obj.portInfo == null || obj.config == undefined) {
        io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\n portInfo: ${obj.portInfo}\nconfig: ${obj.config}`)
      } else {
        io.emit(SocketEvents.OPEN_PORT_RES, await SerialPortManager.open(obj.portInfo, obj.config))
      }
    })

    socket.on(SocketEvents.CLOSE_PORT_REQ, async (tagName) => {
      console.log("close request", tagName)
      if (tagName == undefined || typeof tagName != "string") {
        io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incorretos:\ntagName: ${tagName}`)
      } else {
        io.emit(SocketEvents.CLOSE_PORT_RES, await SerialPortManager.close(tagName))
      }
    })

    socket.on(SocketEvents.WRITE_TO_REQ, async (obj) => {
      console.log("write request", obj)
      if (obj.tagName == undefined || obj.message == undefined) {
        io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\ntagName: ${obj.tagName}\nmessage: ${obj.message}`)
      } else {
        io.emit(SocketEvents.WRITE_TO_RES, await SerialPortManager.write(obj.tagName, obj.message))
      }
    })

    socket.on(SocketEvents.READ_FROM_REQ, async (obj) => {
      console.log("read request", obj)
      if (obj.tagName == undefined) {
        io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\ntagName: ${obj.tagName}`)
      } else {
        io.emit(SocketEvents.READ_FROM_RES, await SerialPortManager.read(obj.tagName, obj.encoding))
      }
    })

  })

} catch (error) {
  io.emit(SocketEvents.SERVER_ERROR, error)
}

http.listen(3000, () => { console.log('Serial WebSocket executando em http://localhost:3000') })

export class SerialPortManager {

  static ports = null
  static openPorts = new Map()

  static async portListUpdate() {
    this.ports = await SerialPort.list()
    return this.ports
  }

  static async open(portInfo, config) {
    return new Promise((resolve) => {

      if (this.openPorts.has(config.tagName)) {

        const port = this.openPorts.get(config.tagName)

        if (port.path == portInfo.path && port.pnpId == portInfo.pnpId) {
          if (port.isOpen) {
            resolve({ path: port.path, success: true, msg: `Opening ${port.path}: porta previamente aberta` })
          }
          else {
            port.open((error) => {
              error != null
                ? resolve({ path: port.path, success: false, msg: error.message })
                : resolve({ path: port.path, success: true, msg: `Opening ${port.path}: porta aberta com sucesso` })
            })
          }
        } else {
          if (port.isOpen) {
            port.close((error) => {
              error != null
                ? resolve({ path: port.path, success: false, msg: error.message })
                : resolve(this.open(portInfo, config))

            })
          } else {
            this.openPorts.delete(config.tagName)
            resolve(this.open(portInfo, config))
          }
        }

      } else {
        for (const port of this.ports) {
          if (port.path == portInfo.path && port.pnpId == portInfo.pnpId) {

            const port = new SerialPort({
              baudRate: config.baudRate || 9600,
              path: portInfo.path,
              dataBits: config.dataBits || 8,
              parity: config.parity,
            }, (error) => {
              if (error != null) {
                resolve({ path: port.path, success: false, msg: error.message })
              } else {
                this.openPorts.set(config.tagName, port)
                console.log(`New port configured: '${config.tagName}' => ${port.path}`)
                port.isOpen
                  ? resolve({ path: port.path, success: true, msg: `Opening ${port.path}: porta aberta com sucesso` })
                  : resolve(this.open(portInfo, config))
              }
            })
          }
        }
      }
    })
  }

  static async close(tagName) {
    return new Promise((resolve) => {

      if (this.openPorts.has(tagName)) {
        const port = this.openPorts.get(tagName)

        if (port.isOpen) {
          port.close((error) => {
            error != null
              ? resolve({ path: port.path, success: true, msg: error.message })
              : resolve({ path: port.path, success: true, msg: `Closing ${port.path}: porta fechada com sucesso` })

          })
        } else {
          resolve({ path: port.path, success: true, msg: `Closing ${port.path}: porta previamente fechada` })
        }

      } else {
        resolve({ path: "Unknown", success: false, msg: `Closing Unknown: porta nunca foi aberta pelo sistema` })
      }
    })
  }

  static async write(tagName, message) {
    return new Promise((resolve) => {
      if (this.openPorts.has(tagName)) {

        const port = this.openPorts.get(tagName)

        if (port.isOpen && port.writable) {

          port.write(message.content, message.encoding, (error) => {
            error != null
              ? resolve({ path: port.path, success: false, msg: error.message })
              : resolve({ path: port.path, success: true, msg: message.content })
          })

        } else {
          resolve({ path: port.path, success: false, msg: "porta fechada ou indisponível" })
        }

      } else {
        resolve({ path: "Unknown", success: false, msg: "porta nunca foi aberta pelo sistema" })
      }
    })
  }

  static async read(tagName, encoding = "hex") {
    return new Promise((resolve) => {
      if (this.openPorts.has(tagName)) {

        const port = this.openPorts.get(tagName)
        port.setEncoding(encoding)

        port.isOpen && port.readable
          ? resolve({ path: port.path, success: true, msg: port.read() })
          : resolve({ path: port.path, success: true, msg: "porta fechada ou indisponível" })

      } else {
        resolve({ path: "Unknown", success: false, msg: "porta nunca foi aberta pelo sistema" })
      }
    })
  }

  static { SerialPortManager.portListUpdate() }
}

export class SocketEvents {
  static PORTLIST_REQ = "port-list-req"
  static PORTLIST_RES = "port-list-res"
  static OPEN_PORT_REQ = "open-port-req"
  static OPEN_PORT_RES = "open-port-res"
  static CLOSE_PORT_REQ = "close-port-req"
  static CLOSE_PORT_RES = "close-port-res"
  static READ_FROM_REQ = "rx-buffer-req"
  static READ_FROM_RES = "rx-buffer-res"
  static WRITE_TO_REQ = "tx-buffer-req"
  static WRITE_TO_RES = "tx-buffer-res"
  static SERVER_ERROR = "server-error"
}
