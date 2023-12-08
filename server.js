import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { SerialPort } from 'serialport'
import ModbusRTU from "modbus-serial"

export class SocketEvents {
  static KEEP_ALIVE = "keep-alive"
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
  static CREATE_MODBUS_REQ = "create-mdb-slave-req"
  static CREATE_MODBUS_RES = "create-mdb-slave-res"
  static SET_NODE_ADDRESS_REQ = "set-mdb-slave-addr-req"
  static SET_NODE_ADDRESS_RES = "set-mdb-slave-addr-res"
  static READ_DEVICE_ID_REQ = "read-device-id-req"
  static READ_DEVICE_ID_RES = "read-device-id-res"
  static READ_INPUT_REGISTERS_REQ = "read-mdb-input-regs-req"
  static READ_INPUT_REGISTERS_RES = "read-mdb-input-regs-res"
  static READ_HOLDING_REGISTERS_REQ = "read-mdb-holding-regs-req"
  static READ_HOLDING_REGISTERS_RES = "read-mdb-holding-regs-res"
  static WRTIE_HOLDING_REGISTER_REQ = "write-mdb-holding-reg-req"
  static WRTIE_HOLDING_REGISTER_RES = "write-mdb-holding-reg-res"
  static WRTIE_HOLDING_REGISTERS_REQ = "write-mdb-holding-regs-req"
  static WRTIE_HOLDING_REGISTERS_RES = "write-mdb-holding-regs-res"
}

const http = createServer()
const io = new Server(http, { cors: { origin: "*" } })

const KEEP_ALIVE_TIMEOUT = 10000
let keepAliveMsgTimestanmp = performance.now()

setInterval(() => {
  const elapsedKeepAliveTimer = performance.now() - keepAliveMsgTimestanmp
  if (elapsedKeepAliveTimer > KEEP_ALIVE_TIMEOUT) {
    process.exit(1)
  }
}, 1000)

io.on('connection', (socket) => {
  //#region SERIAL

  socket.on(SocketEvents.KEEP_ALIVE, () => {
    keepAliveMsgTimestanmp = performance.now()
  })

  socket.on(SocketEvents.PORTLIST_REQ, async () => {
    console.log("portlist request")
    io.emit(SocketEvents.PORTLIST_RES, await SerialPortManager.portListUpdate())
  })

  socket.on(SocketEvents.OPEN_PORT_REQ, async (obj) => {
    console.log("open request", obj)
    if (obj.portInfo == undefined || obj.portInfo == null || obj.config == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\nportInfo: ${obj.portInfo}\nconfig: ${obj.config}`)
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
  //#endregion SERIAL

  //#region MODBUS

  socket.on(SocketEvents.CREATE_MODBUS_REQ, async (obj) => {
    console.log("create mbd slave request", obj)
    if (obj.portInfo == undefined || obj.portInfo == null || obj.config == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\nportInfo: ${obj.portInfo}\nconfig: ${obj.config}`)
    } else {
      io.emit(SocketEvents.CREATE_MODBUS_RES, await ModbusDeviceManager.create(obj.portInfo, obj.config))
    }
  })

  socket.on(SocketEvents.SET_NODE_ADDRESS_REQ, async (obj) => {
    console.log("set mdb node address", obj.nodeAddress, obj.tagName)
    if (isNaN(obj.nodeAddress) || obj.tagName == null || obj.tagName == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\naddr: ${obj.nodeAddress}\ntagName: ${obj.tagName}`)
    } else {
      io.emit(SocketEvents.SET_NODE_ADDRESS_RES, await ModbusDeviceManager.setNodeAddress(obj.nodeAddress, obj.tagName))
    }
  })

  socket.on(SocketEvents.READ_INPUT_REGISTERS_REQ, async (obj) => {
    console.log("read input regs", obj.startAddress, obj.qty, obj.tagName)
    if (isNaN(obj.startAddress) || isNaN(obj.qty) || obj.tagName == null || obj.tagName == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\naddr: ${obj.startAddress}\nquantity: ${obj.qty}\ntagName: ${obj.tagName}`)
    } else {
      io.emit(SocketEvents.READ_INPUT_REGISTERS_RES, await ModbusDeviceManager.readInputRegisters(obj.tagName, obj.startAddress, obj.qty))
    }
  })

  socket.on(SocketEvents.READ_HOLDING_REGISTERS_REQ, async (obj) => {
    console.log("read holding regs", obj.startAddress, obj.qty, obj.tagName)
    if (isNaN(obj.startAddress) || isNaN(obj.qty) || obj.tagName == null || obj.tagName == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\naddr: ${obj.startAddress}\nquantity: ${obj.qty}\ntagName: ${obj.tagName}`)
    } else {
      io.emit(SocketEvents.READ_HOLDING_REGISTERS_RES, await ModbusDeviceManager.readHoldingRegisters(obj.tagName, obj.startAddress, obj.qty))
    }
  })

  socket.on(SocketEvents.WRTIE_HOLDING_REGISTER_REQ, async (obj) => {
    console.log("write reg", obj.startAddress, obj.value, obj.tagName)
    if (isNaN(obj.startAddress) || isNaN(obj.value) || obj.tagName == null || obj.tagName == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\naddr: ${obj.startAddress}\nvalue: ${obj.value}\ntagName: ${obj.tagName}`)
    } else {
      io.emit(SocketEvents.WRTIE_HOLDING_REGISTER_RES, await ModbusDeviceManager.writeHoldingRegister(obj.tagName, obj.startAddress, obj.value))
    }
  })

  socket.on(SocketEvents.WRTIE_HOLDING_REGISTERS_REQ, async (obj) => {
    console.log("write regs", obj.startAddress, obj.arrValues, obj.tagName)
    if (isNaN(obj.startAddress) || !typeof obj.arrValues == Object || obj.tagName == null || obj.tagName == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\naddr: ${obj.startAddress}\narrValues: ${obj.arrValues}\ntagName: ${obj.tagName}`)
    } else {
      io.emit(SocketEvents.WRTIE_HOLDING_REGISTERS_RES, await ModbusDeviceManager.writeHoldingRegisters(obj.tagName, obj.startAddress, obj.arrValues))
    }
  })

  socket.on(SocketEvents.READ_DEVICE_ID_REQ, async (obj) => {
    console.log("read device id", obj.idCode, obj.objectId, obj.tagName)
    if (isNaN(obj.idCode) || isNaN(obj.objectId) || obj.tagName == null || obj.tagName == undefined) {
      io.emit(SocketEvents.SERVER_ERROR, `Parâmetros incompletos:\nidCode: ${obj.idCode}\nobjectId: ${obj.objectId}\ntagName: ${obj.tagName}`)
    } else {
      io.emit(SocketEvents.READ_DEVICE_ID_RES, await ModbusDeviceManager.readDeviceID(obj.tagName, obj.idCode, obj.objectId))
    }
  })
  //#endregion MODBUS
})

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

      if (ModbusDeviceManager.slaves.has(config.tagName)) {

        const slave = ModbusDeviceManager.slaves.get(config.tagName)
        slave.close(() => {
          ModbusDeviceManager.slaves.delete(config.tagName)
          resolve(this.open(portInfo, config))
        })

      } else if (this.openPorts.has(config.tagName)) {

        const port = this.openPorts.get(config.tagName)

        if (port.path == portInfo.path) {
          if (port.isOpen) {
            resolve({ path: port.path, success: true, msg: `Opening ${port.path}: porta previamente aberta` })
          } else {
            port.open((error) => {
              error != null
                ? resolve({ path: port.path, success: false, msg: error.message })
                : resolve({ path: port.path, success: true, msg: `Opening ${port.path}: porta aberta com sucesso` })
            })
          }
        } else {
          if (port.isOpen) {
            port.close((error) => {
              if (error != null) {
                resolve({ path: port.path, success: true, msg: error.message })
              } else {
                this.openPorts.delete(config.tagName)
                resolve(this.open(portInfo, config))
              }
            })
          } else {
            this.openPorts.delete(config.tagName)
            resolve(this.open(portInfo, config))
          }
        }
      } else {
        for (const port of this.ports) {
          if (port.path == portInfo.path && port.pnpId == portInfo.pnpId) {

            const newPort = new SerialPort({
              baudRate: config.baudRate || 9600,
              path: portInfo.path,
              dataBits: config.dataBits || 8,
              parity: config.parity,

            }, (error) => {
              if (error != null) {
                resolve({ path: port.path, success: false, msg: error.message })
              } else {
                this.openPorts.set(config.tagName, newPort)
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
          : resolve({ path: port.path, success: false, msg: "porta fechada ou indisponível" })

      } else {
        resolve({ path: "Unknown", success: false, msg: "porta nunca foi aberta pelo sistema" })
      }
    })
  }

  static { SerialPortManager.portListUpdate() }
}

export class ModbusDeviceManager {

  static MODBUS_RESPONSE_TIMEOUT = 500
  static slaves = new Map()

  static async timeOut(timeout) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ timeout: true })
      }, timeout)
    })
  }

  static create(portInfo, config) {
    return new Promise(async (resolve) => {

      if (!this.slaves.has(config.tagName)) {

        if (SerialPortManager.openPorts.has(config.tagName)) {
          await SerialPortManager.close(config.tagName)
        }

        const slave = new ModbusRTU()
        this.slaves.set(config.tagName, slave)
        try {
          await slave.connectRTUBuffered(portInfo.path, { baudRate: config.baudRate, parity: config.parity })
          resolve({ path: portInfo.path, success: true, msg: "sucesso ao criar slave" })
        } catch (error) {
          resolve({ path: portInfo.path, success: false, msg: `falha ao criar slave: ${error.message}` })
        }
      } else {
        const slave = this.slaves.get(config.tagName)
        resolve({ path: slave.path, success: false, msg: `Unknown: porta nunca foi aberta pelo sistema` })
      }
    })
  }

  static close() { //WIP...
    return new Promise((resolve) => {
      if (this.slaves.has(config.tagName)) {
        const slave = this.slaves.get(config.tagName)
        slave.close(() => {
          this.slaves.delete(config.tagName)
          resolve()
        })
      }
    })
  }

  static setNodeAddress(addr, tagName) {
    return new Promise((resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          slave.setID(addr)
          resolve({ path: slave._port._client.path, success: true, msg: `sucesso ao configurar node address: ${addr}`, addr })
        } catch (error) {
          resolve({ path: slave._port._client.path, success: false, msg: `falha ao setar node address: ${error.message}`, addr })
        }
      } else {
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema` })
      }
    })
  }

  static readInputRegisters(tagName, startAddress, qty) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.readInputRegisters(startAddress, qty), this.timeOut(this.MODBUS_RESPONSE_TIMEOUT)])
          result.hasOwnProperty("timeout")
            ? resolve({ path: slave._port._client.path, success: false, msg: `falha ao ler registradores: timeout` })
            : resolve({ path: slave._port._client.path, success: true, msg: result.data })
        } catch (error) {
          resolve({ path: slave._port._client.path, success: false, msg: `falha ao ler registradores: ${error.message}` })
        }
      } else {
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema` })
      }
    })
  }

  static readHoldingRegisters(tagName, startAddress, qty) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.readHoldingRegisters(startAddress, qty), this.timeOut(this.MODBUS_RESPONSE_TIMEOUT)])
          result.hasOwnProperty("timeout")
            ? resolve({ path: slave._port._client.path, success: false, msg: `falha ao ler registradores: timeout` })
            : resolve({ path: slave._port._client.path, success: true, msg: result.data })
        } catch (error) {
          resolve({ path: slave._port._client.path, success: false, msg: `falha ao ler registradores: ${error.message}` })
        }
      } else {
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema` })
      }
    })
  }

  static writeHoldingRegister(tagName, startAddress, value) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.writeRegister(startAddress, value), this.timeOut(this.MODBUS_RESPONSE_TIMEOUT)])
          result.hasOwnProperty("timeout")
            ? resolve({ path: slave._port._client.path, success: false, msg: `falha ao escrever em registradores: timeout` })
            : resolve({ path: slave._port._client.path, success: true, msg: result })
        } catch (error) {
          resolve({ path: slave._port._client.path, success: false, msg: `falha ao escrever nos registradores: ${error.message}` })
        }
      } else {
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema` })
      }
    })
  }

  static writeHoldingRegisters(tagName, startAddress, arrValues) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.writeRegisters(startAddress, arrValues), this.timeOut(this.MODBUS_RESPONSE_TIMEOUT)])
          result.hasOwnProperty("timeout")
            ? resolve({ path: slave._port._client.path, success: false, msg: `falha ao escrever em registradores: timeout` })
            : resolve({ path: slave._port._client.path, success: true, msg: result })
        } catch (error) {
          resolve({ path: slave._port._client.path, success: false, msg: `falha ao escrever nos registradores: ${error.message}` })
        }
      } else {
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema` })
      }
    })
  }

  static readDeviceID(tagName, idCode, objectId) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await slave.readDeviceIdentification(idCode, objectId)
          resolve({ path: slave._port._client.path, success: true, msg: result })
        } catch (error) {
          resolve({ path: slave._port._client.path, success: false, msg: `falha ao obter identificação: ${error.message}` })
        }
      } else {
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema` })
      }
    })
  }
}