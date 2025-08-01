import ModbusRTU from "modbus-serial"
import { Server } from 'socket.io'
import { SerialPort } from 'serialport'
import { createServer } from 'node:http'

export class SocketEvents {
  static KILL_PROCESS = "kill-process"
  static PORTLIST_REQ = "port-list-req"
  static PORTLIST_RES = "port-list-res"
  static OPENPORTS_REQ = "get-openports-req"
  static OPENPORTS_RES = "get-openports-res"
  static ACTIVE_SLAVE_REQ = "active-slave-req"
  static ACTIVE_SLAVE_RES = "active-slave-res"
  static OPEN_PORT_REQ = "open-port-req"
  static OPEN_PORT_RES = "open-port-res"
  static CLOSE_PORT_REQ = "close-port-req"
  static CLOSE_PORT_RES = "close-port-res"
  static READ_FROM_REQ = "rx-buffer-req"
  static READ_FROM_RES = "rx-buffer-res"
  static WRITE_TO_REQ = "tx-buffer-req"
  static WRITE_TO_RES = "tx-buffer-res"
  static SERVER_ERROR = "server-error"
  static OPEN_MODBUS_REQ = "open-mdb-slave-req"
  static OPEN_MODBUS_RES = "open-mdb-slave-res"
  static CLOSE_MODBUS_REQ = "close-mdb-slave-req"
  static CLOSE_MODBUS_RES = "close-mdb-slave-res"
  static FREE_SLAVE_REQ = "free-mdb-slave-req"
  static FREE_SLAVE_RES = "free-mdb-slave-res"
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

const CLIENT_MONITORING_INTERVAL = 500
const INATIVITY_TIMEOUT = 10000

const SERVER_PORT = 3000
const http = createServer()
const io = new Server(http, { cors: { origin: "*" } })


/**
 * Validates the type of a property in an object.
 *
 * @param {Object} obj - The object to evaluate.
 * @param {string} propName - The name of the property to validate.
 * @param {string} expectedType - The expected data type of the property.
 * @return {{success: boolean, msg: string}} An object indicating the success of the validation and a message.
 */
function evalProps(obj, propName, expectedType) {
  if (!propName in obj) { return { success: false, msg: `Propriedade ${propName} não informada no objeto passado` } }
  if (obj[propName] == null || obj[propName] == undefined) { return { success: false, msg: `Propriedade ${propName} possui valor inválido: ${obj[propName]}` } }

  const prop = obj[propName]
  const propType = typeof prop

  if (propType != expectedType) { return { success: false, msg: `Propriedade ${propName} é do tipo ${propType}. Precisa ser do tipo: ${expectedType}` } }
  return { success: true, msg: `Propriedade ${propName} validada com sucesso` }
}

function mapToObject(map) { return Object.fromEntries(map.entries()) }

io.on('connection', (socket) => {

  //#region GLOBAL
  socket.on(SocketEvents.KILL_PROCESS, () => {
    process.exit(10)
  })

  socket.on(SocketEvents.PORTLIST_REQ, async () => {
    console.log("portlist request")
    io.emit(SocketEvents.PORTLIST_RES, await SerialPortManager.portListUpdate())
  })

  socket.on(SocketEvents.OPENPORTS_REQ, async () => {
    console.log("openports request")
    io.emit(SocketEvents.OPENPORTS_RES, mapToObject(SerialPortManager.openPorts))
  })

  socket.on(SocketEvents.ACTIVE_SLAVE_REQ, async () => {
    console.log("active slaves request")
    io.emit(SocketEvents.ACTIVE_SLAVE_RES, mapToObject(ModbusDeviceManager.slaves))
  })
  //#endregion GLOBAL

  //#region SERIAL
  socket.on(SocketEvents.OPEN_PORT_REQ, async (obj) => {
    console.log("open request", obj)

    const evalPortInfo = evalProps(obj, 'portInfo', 'object')
    const evalConfig = evalProps(obj, 'config', 'object')

    if (!evalPortInfo.success || !evalConfig.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalPortInfo.msg}\n${evalConfig.msg}`)
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

    const evalTagName = evalProps(obj, 'tagName', 'string')
    const evalMessage = evalProps(obj, 'message', 'object')
    const evalContentAsArray = evalProps(obj.message, 'content', 'object')
    const evalContentAsString = evalProps(obj.message, 'content', 'string')

    if (!evalTagName.success || !evalMessage.success || (!evalContentAsString.success && !evalContentAsArray.success)) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalTagName.msg}\n${evalMessage.msg}\n${evalContentAsString.msg}`)
    } else {
      io.emit(SocketEvents.WRITE_TO_RES, await SerialPortManager.write(obj.tagName, obj.message))
    }
  })

  socket.on(SocketEvents.READ_FROM_REQ, async (obj) => {
    console.log("read request", obj)

    const evalTagName = evalProps(obj, 'tagName', 'string')

    if (!evalTagName.success) {
      io.emit(SocketEvents.SERVER_ERROR, evalTagName.msg)
    } else {
      io.emit(SocketEvents.READ_FROM_RES, await SerialPortManager.read(obj.tagName, obj.encoding))
    }
  })
  //#endregion SERIAL

  //#region MODBUS

  socket.on(SocketEvents.OPEN_MODBUS_REQ, async (obj) => {
    console.log("open mbd slave request", obj)

    const evalTagName = evalProps(obj, 'tagName', 'string')

    if (!evalTagName.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalTagName.msg}`)
    } else {
      io.emit(SocketEvents.OPEN_MODBUS_RES, await ModbusDeviceManager.open(obj.tagName))
    }
  })

  socket.on(SocketEvents.CLOSE_MODBUS_REQ, async (obj) => {
    console.log("close mbd slave request", obj)

    const evalTagName = evalProps(obj, 'tagName', 'string')

    if (!evalTagName.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalTagName.msg}`)
    } else {
      io.emit(SocketEvents.CLOSE_MODBUS_RES, await ModbusDeviceManager.close(obj.tagName))
    }
  })

  socket.on(SocketEvents.FREE_SLAVE_REQ, async (obj) => {
    console.log("close mbd slave request", obj)

    const evalTagName = evalProps(obj, 'tagName', 'string')

    if (!evalTagName.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalTagName.msg}`)
    } else {
      io.emit(SocketEvents.FREE_SLAVE_RES, await ModbusDeviceManager.freeSlave(obj.tagName))
    }
  })

  socket.on(SocketEvents.CREATE_MODBUS_REQ, async (obj) => {
    console.log("create mbd slave request", obj)

    const evalPortInfo = evalProps(obj, 'portInfo', 'object')
    const evalConfig = evalProps(obj, 'config', 'object')

    if (!evalPortInfo.success || !evalConfig.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalPortInfo.msg}\n${evalConfig.msg}`)
    } else {
      io.emit(SocketEvents.CREATE_MODBUS_RES, await ModbusDeviceManager.create(obj.portInfo, obj.config))
    }
  })

  socket.on(SocketEvents.SET_NODE_ADDRESS_REQ, async (obj) => {
    console.log("set mdb node address", obj)

    const evalNodeAddress = evalProps(obj, 'nodeAddress', 'number')
    const evalTagName = evalProps(obj, 'tagName', 'string')

    if (!evalNodeAddress.success || !evalTagName.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalNodeAddress.msg}\n${evalTagName.msg}`)
    } else {
      io.emit(SocketEvents.SET_NODE_ADDRESS_RES, await ModbusDeviceManager.setNodeAddress(obj.nodeAddress, obj.tagName))
    }
  })

  socket.on(SocketEvents.READ_INPUT_REGISTERS_REQ, async (obj) => {
    console.log("read input regs", obj)

    const evalStartAddress = evalProps(obj, 'startAddress', 'number')
    const evalTagName = evalProps(obj, 'tagName', 'string')
    const evalQty = evalProps(obj, 'qty', 'number')

    if (!evalStartAddress.success || !evalTagName.success || !evalQty.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalStartAddress.msg}\n${evalTagName.msg}\n${evalQty.msg}`)
    } else {
      io.emit(SocketEvents.READ_INPUT_REGISTERS_RES, await ModbusDeviceManager.readInputRegisters(obj.tagName, obj.startAddress, obj.qty))
    }
  })

  socket.on(SocketEvents.READ_HOLDING_REGISTERS_REQ, async (obj) => {
    console.log("read holding regs", obj)

    const evalStartAddress = evalProps(obj, 'startAddress', 'number')
    const evalTagName = evalProps(obj, 'tagName', 'string')
    const evalQty = evalProps(obj, 'qty', 'number')

    if (!evalStartAddress.success || !evalTagName.success || !evalQty.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalStartAddress.msg}\n${evalTagName.msg}\n${evalQty.msg}`)
    } else {
      io.emit(SocketEvents.READ_HOLDING_REGISTERS_RES, await ModbusDeviceManager.readHoldingRegisters(obj.tagName, obj.startAddress, obj.qty))
    }
  })

  socket.on(SocketEvents.WRTIE_HOLDING_REGISTER_REQ, async (obj) => {
    console.log("write reg", obj)

    const evalStartAddress = evalProps(obj, 'startAddress', 'number')
    const evalTagName = evalProps(obj, 'tagName', 'string')
    const evalValue = evalProps(obj, 'value', 'number')

    if (!evalStartAddress.success || !evalTagName.success || !evalValue.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalStartAddress.msg}\n${evalTagName.msg}\n${evalValue.msg}`)
    } else {
      io.emit(SocketEvents.WRTIE_HOLDING_REGISTER_RES, await ModbusDeviceManager.writeHoldingRegister(obj.tagName, obj.startAddress, obj.value))
    }
  })

  socket.on(SocketEvents.WRTIE_HOLDING_REGISTERS_REQ, async (obj) => {
    console.log("write regs", obj)

    const evalStartAddress = evalProps(obj, 'startAddress', 'number')
    const evalTagName = evalProps(obj, 'tagName', 'string')
    const evalValues = evalProps(obj, 'arrValues', 'object')

    if (!evalStartAddress.success || !evalTagName.success || !evalValues.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalStartAddress.msg}\n${evalTagName.msg}\n${evalValues.msg}`)
    } else {
      io.emit(SocketEvents.WRTIE_HOLDING_REGISTERS_RES, await ModbusDeviceManager.writeHoldingRegisters(obj.tagName, obj.startAddress, obj.arrValues))
    }
  })

  socket.on(SocketEvents.READ_DEVICE_ID_REQ, async (obj) => {
    console.log("read device id", obj)

    const evalIdCode = evalProps(obj, 'idCode', 'number')
    const evalTagName = evalProps(obj, 'tagName', 'string')
    const evalObjectId = evalProps(obj, 'objectId', 'number')

    if (!evalIdCode.success || !evalTagName.success || !evalObjectId.success) {
      io.emit(SocketEvents.SERVER_ERROR, `${evalIdCode.msg}\n${evalTagName.msg}\n${evalObjectId.msg}`)
    } else {
      io.emit(SocketEvents.READ_DEVICE_ID_RES, await ModbusDeviceManager.readDeviceID(obj.tagName, obj.idCode, obj.objectId))
    }
  })
  //#endregion MODBUS
})

http.listen(SERVER_PORT, () => { console.log(`Serial WebSocket executando em http://localhost:${SERVER_PORT}`) })
class Utils {
  static delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

async function shouldExit(io) {
  const start = Date.now()

  while (Date.now() - start < INATIVITY_TIMEOUT) {
    if (io.engine.clientsCount > 0) return false
    await Utils.delay(CLIENT_MONITORING_INTERVAL)
  }

  return true
}

async function watchForInactivity(io) {
  while (true) {
    if (io.engine.clientsCount === 0) {
      const exit = await shouldExit(io)

      if (exit) {
        console.log("Encerrando servidor serialport-websocket por inatividade")
        process.exit(0)
      }
    }

    await Utils.delay(CLIENT_MONITORING_INTERVAL)
  }
}

// Chamada principal
watchForInactivity(io)

export class SerialPortManager {

  static ports = null

  /** @type {Map<string, SerialPort>} */
  static openPorts = new Map()

  /**
   * Retrieves a list of available serial ports and updates the class property `ports`.
   *
   * @return {Promise<Array<Object>>} A Promise that resolves with an array of serial port objects.
   */
  static async portListUpdate() {
    this.ports = await SerialPort.list()
    return this.ports
  }

  /**
   * Opens a serial port with the specified configuration.
   *
   * @param { Object } portInfo - Information about the port.
   * @param {{ baudRate: number, parity: string, tagName: string }} config - Configuration options.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and a message.
   */
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

  /**
   * Closes a port if it is open and deletes it from the openPorts map.
   *
   * @param {string} tagName - The tag name of the port to close.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and a message.
   */
  static async close(tagName) {
    return new Promise((resolve) => {

      if (this.openPorts.has(tagName)) {
        const port = this.openPorts.get(tagName)

        if (port.isOpen) {
          port.close((error) => {
            error != null
              ? resolve({ path: port.path, success: true, msg: error.message })
              : resolve({ path: port.path, success: true, msg: `Closing ${port.path}: porta fechada com sucesso` })
            SerialPortManager.openPorts.delete(tagName)
          })
        } else {
          resolve({ path: port.path, success: true, msg: `Closing ${port.path}: porta previamente fechada` })
          SerialPortManager.openPorts.delete(tagName)
        }

      } else {
        resolve({ path: "Unknown", success: false, msg: `Closing Unknown: porta nunca foi aberta pelo sistema` })
      }
    })
  }

  /**
   * A function to write data to a port if it is open and writable.
   * 
   * @param {string} tagName - The tag name of the port.
   * @param {{ content: string | Array<number>, encoding: BufferEncoding}} message - The message object containing content and encoding.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing path, success status, and a message.
   */
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

  /**
   * A description of the entire function.
   *
   * @param {string} tagName - description of parameter
   * @param {string} [encoding="hex"] - description of parameter
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing path, success status, and a message.
   */
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

  static MODBUS_RESPONSE_TIMEOUT = 200

  /** @type {Map<string, ModbusRTU>} */
  static slaves = new Map()

  static async timeout(timeout) {
    return new Promise((resolve) => { setTimeout(() => { resolve({ timeout: true }) }, timeout) })
  }


  /**
   * Creates a new Modbus slave.
   *
   * @param {Object} portInfo - Information about the port.
   * @param {{ baudRate: number, parity: string, tagName: string }} config - Configuration options.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and a message.
   */
  static create(portInfo, config) {
    return new Promise(async (resolve) => {

      if (!this.slaves.has(config.tagName)) {

        if (SerialPortManager.openPorts.has(config.tagName)) {
          await SerialPortManager.close(config.tagName)
          SerialPortManager.openPorts.delete(config.tagName)
        }

        const slave = new ModbusRTU()
        this.slaves.set(config.tagName, slave)
        resolve(this.create(portInfo, config))

      } else {
        try {
          const slave = this.slaves.get(config.tagName)
          if (!slave.isOpen) {
            slave.connectRTUBuffered(portInfo.path, { baudRate: config.baudRate, parity: config.parity })
          }
          resolve({ path: portInfo.path, success: true, msg: "sucesso ao criar slave" })
        } catch (error) {
          resolve({ path: portInfo.path, success: false, msg: `falha ao criar slave: ${error.message}` })
        }

      }
    })
  }

  /**
   * Closes a slave device.
   *
   * @param {string} tagName - The tag name of the slave device.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A promise that resolves with an object containing the path, success status, and a message.
   */
  static close(tagName) {
    return new Promise((resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        slave.close((err) => {
          if (err != null) {
            if (err.message.includes("Port is not open")) {
              resolve({ path: slave._port._client.path, success: true, msg: `sucesso ao fechar slave: porta previamente fechada` })
            } else {
              resolve({ path: slave._port._client.path, success: false, msg: `falha ao fechar slave: ${err}` })
            }
          } else {
            resolve({ path: slave._port._client.path, success: true, msg: `sucesso ao fechar slave` })
          }
        })
      }
    })
  }

  /**
   * A function to open a slave based on the provided tagName.
   *
   * @param {string} tagName - The tag name of the slave to be opened.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A promise that resolves with information about the success or failure of opening the slave.
   */
  static open(tagName) {
    return new Promise((resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        slave.open((err) => {
          if (err != null) {
            if (err.message.includes("Port is already open")) {
              resolve({ path: slave._port._client.path, success: true, msg: `sucesso ao abrir slave: porta previamente aberta` })
            } else {
              resolve({ path: slave._port._client.path, success: false, msg: `falha ao abrir slave: ${err}` })
            }
          } else {
            resolve({ path: slave._port._client.path, success: true, msg: `sucesso ao abrir slave` })
          }
        })
      }
    })
  }

  /**
   * A function that frees a slave based on the given tagName.
   *
   * @param {string} tagName - The tag name of the slave to be freed.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing path, success status, and a message.
   */
  static freeSlave(tagName) {
    return new Promise((resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        slave.close(() => {
          this.slaves.delete(tagName)
          resolve({ path: slave._port._client.path, success: true, msg: `sucesso ao libertar slave` })
        })
      }
    })
  }

  /**
   * Sets the node address for a slave device.
   *
   * @param {number} addr - The new node address to set.
   * @param {string} tagName - The tag name of the slave device.
   * @return {Promise<{path: string, success: boolean, msg: string, addr: number}>} A Promise that resolves with an object containing the path, success status, a message, and the new node address.
   */
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
        resolve({ path: "Unknown", success: false, msg: `Unknown: slave nunca foi criado pelo sistema`, addr: null })
      }
    })
  }

  /**
   * Reads input registers from a slave device.
   *
   * @param {string} tagName - The tag name of the slave device.
   * @param {number} startAddress - The starting address to read from.
   * @param {number} qty - The quantity of registers to read.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and message.
   */
  static readInputRegisters(tagName, startAddress, qty) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.readInputRegisters(startAddress, qty), this.timeout(this.MODBUS_RESPONSE_TIMEOUT)])
          "timeout" in result
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

  /**
   * A function to read holding registers from a slave device.
   *
   * @param {string} tagName - The tag name of the slave device.
   * @param {number} startAddress - The starting address to read from.
   * @param {number} qty - The quantity of registers to read.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and message.
   */
  static readHoldingRegisters(tagName, startAddress, qty) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.readHoldingRegisters(startAddress, qty), this.timeout(this.MODBUS_RESPONSE_TIMEOUT)])
          "timeout" in result
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

  /**
   * A function to write a holding register for a slave device.
   *
   * @param {string} tagName - The tag name of the slave device.
   * @param {number} startAddress - The starting address to write to.
   * @param {number} value - The value to write to the register.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and message.
   */
  static writeHoldingRegister(tagName, startAddress, value) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.writeRegister(startAddress, value), this.timeout(this.MODBUS_RESPONSE_TIMEOUT)])
          "timeout" in result
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

  /**
   * A function to write holding registers for a slave device.
   *
   * @param {string} tagName - The tag name of the slave device.
   * @param {number} startAddress - The starting address to write to.
   * @param {Array<number>} arrValues - An array of values to write to the holding registers.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and message.
   */
  static writeHoldingRegisters(tagName, startAddress, arrValues) {
    return new Promise(async (resolve) => {
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        try {
          const result = await Promise.race([slave.writeRegisters(startAddress, arrValues), this.timeout(this.MODBUS_RESPONSE_TIMEOUT)])
          "timeout" in result
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

  /**
   * A function to read the device identification based on the provided tag name, id code, and object id.
   *
   * @param {string} tagName - The tag name of the device.
   * @param {number} idCode - The identification code of the device.
   * @param {number} objectId - The object id of the device.
   * @return {Promise<{path: string, success: boolean, msg: string}>} A Promise that resolves with an object containing the path, success status, and message.
   */
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