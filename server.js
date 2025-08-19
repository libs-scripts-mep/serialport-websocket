import { SerialPort } from 'serialport'
import ModbusRTU from "modbus-serial"
import { WebSocketServer } from 'ws'
import { createServer } from 'http'

// --- Configurações do Servidor ---
const SERVER_PORT = 3000
const INACTIVITY_TIMEOUT = 10000 // 10 segundos sem clientes = encerra

let inactivityTimer = null

// Servidor HTTP básico só para o handshake do WebSocket
const server = createServer()
const wss = new WebSocketServer({ server })

// As classes e funções utilitárias permanecem as mesmas
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
  static WRITE_HOLDING_REGISTER_REQ = "write-mdb-holding-reg-req"
  static WRITE_HOLDING_REGISTER_RES = "write-mdb-holding-reg-res"
  static WRITE_HOLDING_REGISTERS_REQ = "write-mdb-holding-regs-req"
  static WRITE_HOLDING_REGISTERS_RES = "write-mdb-holding-regs-res"
}

// Funções utilitárias mantidas sem alteração
function evalProps(obj, propName, expectedType) {
  if (!propName in obj) { return { success: false, msg: `Propriedade ${propName} não informada no objeto passado` } }
  if (obj[propName] == null || obj[propName] == undefined) { return { success: false, msg: `Propriedade ${propName} possui valor inválido: ${obj[propName]}` } }
  const prop = obj[propName]
  const propType = typeof prop
  if (propType != expectedType) { return { success: false, msg: `Propriedade ${propName} é do tipo ${propType}. Precisa ser do tipo: ${expectedType}` } }
  return { success: true, msg: `Propriedade ${propName} validada com sucesso` }
}
function mapToObject(map) { return Object.fromEntries(map.entries()) }

// Lógica principal do servidor WebSocket
wss.on('connection', (socket) => {
  console.log("[SERIAL SERVER]🟢 client connected")

  // Ao receber uma conexão, limpa o timer de inatividade se ele estiver ativo
  clearTimeout(inactivityTimer)

  // Lógica para quando um cliente se desconecta
  socket.on('close', () => {
    console.log("[SERIAL SERVER]🔴 client disconnected")

    // Inicia o timer de inatividade se não houver mais clientes
    if (wss.clients.size === 0) {
      inactivityTimer = setTimeout(() => {
        if (wss.clients.size === 0) {
          console.log("[SERVER] Encerrando servidor por inatividade")
          process.exit(0)
        }
      }, INACTIVITY_TIMEOUT)
    }
  })

  // Lógica para lidar com as mensagens recebidas
  socket.on('message', async (message) => {
    const { event, data, token } = JSON.parse(message)

    // As respostas agora são enviadas usando socket.send()
    const sendResponse = (responseEvent, responseData, token) => {
      socket.send(JSON.stringify({ event: responseEvent, data: responseData, token }))
    }

    switch (event) {
      case SocketEvents.KILL_PROCESS:
        process.exit(10)
        break

      case SocketEvents.PORTLIST_REQ:
        console.log("[SERIAL SERVER]portlist request")
        const portList = await SerialPortManager.portListUpdate()
        sendResponse(SocketEvents.PORTLIST_RES, portList, token)
        break

      case SocketEvents.OPENPORTS_REQ:
        console.log("[SERIAL SERVER]openports request")
        sendResponse(SocketEvents.OPENPORTS_RES, mapToObject(SerialPortManager.openPorts), token)
        break

      case SocketEvents.ACTIVE_SLAVE_REQ:
        console.log("[SERIAL SERVER]active slaves request")
        sendResponse(SocketEvents.ACTIVE_SLAVE_RES, mapToObject(ModbusDeviceManager.slaves), token)
        break

      case SocketEvents.OPEN_PORT_REQ:
        console.log("[SERIAL SERVER]open request", data)
        const evalPortInfo = evalProps(data, 'portInfo', 'object')
        const evalConfig = evalProps(data, 'config', 'object')

        if (!evalPortInfo.success || !evalConfig.success) {
          sendResponse(SocketEvents.OPEN_PORT_RES, { success: false, msg: `${evalPortInfo.msg}\n${evalConfig.msg}`, path: "Unknown" }, token)
        } else {
          const result = await SerialPortManager.open(data.portInfo, data.config)
          sendResponse(SocketEvents.OPEN_PORT_RES, result, token)
        }
        break

      case SocketEvents.CLOSE_PORT_REQ:
        console.log("[SERIAL SERVER]close request", data)
        const tagName = data
        if (tagName == undefined || typeof tagName != "string") {
          sendResponse(SocketEvents.CLOSE_PORT_RES, { success: false, msg: `Parâmetros incorretos:\ntagName: ${tagName}`, path: "Unknown" }, token)
        } else {
          const result = await SerialPortManager.close(tagName)
          sendResponse(SocketEvents.CLOSE_PORT_RES, result, token)
        }
        break

      case SocketEvents.WRITE_TO_REQ:
        console.log("[SERIAL SERVER]write request", data)
        const evalTagName = evalProps(data, 'tagName', 'string')
        const evalMessage = evalProps(data, 'message', 'object')
        const evalContentAsArray = evalProps(data.message, 'content', 'object')
        const evalContentAsString = evalProps(data.message, 'content', 'string')

        if (!evalTagName.success || !evalMessage.success || (!evalContentAsString.success && !evalContentAsArray.success)) {
          sendResponse(SocketEvents.WRITE_TO_RES, { success: false, msg: `${evalTagName.msg}\n${evalMessage.msg}\n${evalContentAsString.msg}`, path: "Unknown" }, token)
        } else {
          const result = await SerialPortManager.write(data.tagName, data.message)
          sendResponse(SocketEvents.WRITE_TO_RES, result, token)
        }
        break

      case SocketEvents.READ_FROM_REQ:
        console.log("[SERIAL SERVER]read request", data)
        const evalTagNameRead = evalProps(data, 'tagName', 'string')
        if (!evalTagNameRead.success) {
          sendResponse(SocketEvents.READ_FROM_RES, { success: false, msg: evalTagNameRead.msg, path: "Unknown" }, token)
        } else {
          const result = await SerialPortManager.read(data.tagName, data.encoding)
          sendResponse(SocketEvents.READ_FROM_RES, result, token)
        }
        break

      case SocketEvents.OPEN_MODBUS_REQ:
        console.log("[SERIAL SERVER]open mbd slave request", data)
        const evalTagNameOpenMdb = evalProps(data, 'tagName', 'string')

        if (!evalTagNameOpenMdb.success) {
          sendResponse(SocketEvents.OPEN_MODBUS_RES, { success: false, msg: `${evalTagNameOpenMdb.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.open(data.tagName)
          sendResponse(SocketEvents.OPEN_MODBUS_RES, result, token)
        }
        break

      case SocketEvents.CLOSE_MODBUS_REQ:
        console.log("[SERIAL SERVER]close mbd slave request", data)
        const evalTagNameCloseMdb = evalProps(data, 'tagName', 'string')

        if (!evalTagNameCloseMdb.success) {
          sendResponse(SocketEvents.CLOSE_MODBUS_RES, { success: false, msg: `${evalTagNameCloseMdb.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.close(data.tagName)
          sendResponse(SocketEvents.CLOSE_MODBUS_RES, result, token)
        }
        break

      case SocketEvents.FREE_SLAVE_REQ:
        console.log("[SERIAL SERVER]free mdb slave request", data)
        const evalTagNameFreeSlave = evalProps(data, 'tagName', 'string')

        if (!evalTagNameFreeSlave.success) {
          sendResponse(SocketEvents.FREE_SLAVE_RES, { success: false, msg: `${evalTagNameFreeSlave.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.freeSlave(data.tagName)
          sendResponse(SocketEvents.FREE_SLAVE_RES, result, token)
        }
        break

      case SocketEvents.CREATE_MODBUS_REQ:
        console.log("[SERIAL SERVER]create mbd slave request", data)
        const evalPortInfoCreate = evalProps(data, 'portInfo', 'object')
        const evalConfigCreate = evalProps(data, 'config', 'object')

        if (!evalPortInfoCreate.success || !evalConfigCreate.success) {
          sendResponse(SocketEvents.CREATE_MODBUS_RES, { success: false, msg: `${evalPortInfoCreate.msg}\n${evalConfigCreate.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.create(data.portInfo, data.config)
          sendResponse(SocketEvents.CREATE_MODBUS_RES, result, token)
        }
        break

      case SocketEvents.SET_NODE_ADDRESS_REQ:
        console.log("[SERIAL SERVER]set mdb node address", data)
        const evalNodeAddress = evalProps(data, 'nodeAddress', 'number')
        const evalTagNameSetAddr = evalProps(data, 'tagName', 'string')

        if (!evalNodeAddress.success || !evalTagNameSetAddr.success) {
          sendResponse(SocketEvents.SET_NODE_ADDRESS_RES, { success: false, msg: `${evalNodeAddress.msg}\n${evalTagNameSetAddr.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.setNodeAddress(data.nodeAddress, data.tagName)
          sendResponse(SocketEvents.SET_NODE_ADDRESS_RES, result, token)
        }
        break

      case SocketEvents.READ_INPUT_REGISTERS_REQ:
        console.log("[SERIAL SERVER]read input regs", data)
        const evalStartAddressInput = evalProps(data, 'startAddress', 'number')
        const evalTagNameInput = evalProps(data, 'tagName', 'string')
        const evalQtyInput = evalProps(data, 'qty', 'number')

        if (!evalStartAddressInput.success || !evalTagNameInput.success || !evalQtyInput.success) {
          sendResponse(SocketEvents.READ_INPUT_REGISTERS_RES, { success: false, msg: `${evalStartAddressInput.msg}\n${evalTagNameInput.msg}\n${evalQtyInput.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.readInputRegisters(data.tagName, data.startAddress, data.qty)
          sendResponse(SocketEvents.READ_INPUT_REGISTERS_RES, result, token)
        }
        break

      case SocketEvents.READ_HOLDING_REGISTERS_REQ:
        console.log("[SERIAL SERVER]read holding regs", data)
        const evalStartAddressHolding = evalProps(data, 'startAddress', 'number')
        const evalTagNameHolding = evalProps(data, 'tagName', 'string')
        const evalQtyHolding = evalProps(data, 'qty', 'number')

        if (!evalStartAddressHolding.success || !evalTagNameHolding.success || !evalQtyHolding.success) {
          sendResponse(SocketEvents.READ_HOLDING_REGISTERS_RES, { success: false, msg: `${evalStartAddressHolding.msg}\n${evalTagNameHolding.msg}\n${evalQtyHolding.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.readHoldingRegisters(data.tagName, data.startAddress, data.qty)
          sendResponse(SocketEvents.READ_HOLDING_REGISTERS_RES, result, token)
        }
        break

      case SocketEvents.WRITE_HOLDING_REGISTER_REQ:
        console.log("[SERIAL SERVER]write reg", data)
        const evalStartAddressWriteReg = evalProps(data, 'startAddress', 'number')
        const evalTagNameWriteReg = evalProps(data, 'tagName', 'string')
        const evalValueWriteReg = evalProps(data, 'value', 'number')

        if (!evalStartAddressWriteReg.success || !evalTagNameWriteReg.success || !evalValueWriteReg.success) {
          sendResponse(SocketEvents.WRITE_HOLDING_REGISTER_RES, { success: false, msg: `${evalStartAddressWriteReg.msg}\n${evalTagNameWriteReg.msg}\n${evalValueWriteReg.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.writeHoldingRegister(data.tagName, data.startAddress, data.value)
          sendResponse(SocketEvents.WRITE_HOLDING_REGISTER_RES, result, token)
        }
        break

      case SocketEvents.WRITE_HOLDING_REGISTERS_REQ:
        console.log("[SERIAL SERVER]write regs", data)
        const evalStartAddressWriteRegs = evalProps(data, 'startAddress', 'number')
        const evalTagNameWriteRegs = evalProps(data, 'tagName', 'string')
        const evalValuesWriteRegs = evalProps(data, 'arrValues', 'object')

        if (!evalStartAddressWriteRegs.success || !evalTagNameWriteRegs.success || !evalValuesWriteRegs.success) {
          sendResponse(SocketEvents.WRITE_HOLDING_REGISTERS_RES, { success: false, msg: `${evalStartAddressWriteRegs.msg}\n${evalTagNameWriteRegs.msg}\n${evalValuesWriteRegs.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.writeHoldingRegisters(data.tagName, data.startAddress, data.arrValues)
          sendResponse(SocketEvents.WRITE_HOLDING_REGISTERS_RES, result, token)
        }
        break

      case SocketEvents.READ_DEVICE_ID_REQ:
        console.log("[SERIAL SERVER]read device id", data)
        const evalIdCode = evalProps(data, 'idCode', 'number')
        const evalTagNameReadId = evalProps(data, 'tagName', 'string')
        const evalObjectId = evalProps(data, 'objectId', 'number')

        if (!evalIdCode.success || !evalTagNameReadId.success || !evalObjectId.success) {
          sendResponse(SocketEvents.READ_DEVICE_ID_RES, { success: false, msg: `${evalIdCode.msg}\n${evalTagNameReadId.msg}\n${evalObjectId.msg}`, path: "Unknown" }, token)
        } else {
          const result = await ModbusDeviceManager.readDeviceID(data.tagName, data.idCode, data.objectId)
          sendResponse(SocketEvents.READ_DEVICE_ID_RES, result, token)
        }
        break

      default:
        console.log(`[SERIAL SERVER] evento desconhecido: ${event}`)
        sendResponse(SocketEvents.SERVER_ERROR, `Evento desconhecido: ${event}`, token)
    }
  })
})

// Inicia o servidor na porta especificada
server.listen(SERVER_PORT, () => {
  console.log(`[SERIAL SERVER]Serial WebSocket executando em http://localhost:${SERVER_PORT}`)
})

class Utils {
  static delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

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
                console.log(`[SERIAL SERVER]New port configured: '${config.tagName}' => ${port.path}`)
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


  static async create(portInfo, config) {
    return new Promise(async (resolve) => {
      const { tagName, baudRate, parity } = config

      // Se o slave já existe, verificar e abrir a porta se necessário
      if (this.slaves.has(tagName)) {
        const slave = this.slaves.get(tagName)
        if (!slave.isOpen) {
          try {
            await slave.connectRTUBuffered(portInfo.path, { baudRate, parity })
            resolve({ path: portInfo.path, success: true, msg: `Modbus ${tagName} created and port opened` })
          } catch (error) {
            resolve({ path: portInfo.path, success: false, msg: `Failed to open Modbus ${tagName}: ${error.message}` })
          }
        } else {
          resolve({ path: portInfo.path, success: true, msg: `Modbus ${tagName} already created and open` })
        }
        return
      }

      // Fechar a porta serial se já estiver aberta
      if (SerialPortManager.openPorts.has(tagName)) {
        await SerialPortManager.close(tagName)
        SerialPortManager.openPorts.delete(tagName)
      }

      // Criar novo slave Modbus e abrir a porta
      try {
        const slave = new ModbusRTU()
        this.slaves.set(tagName, slave)
        await slave.connectRTUBuffered(portInfo.path, { baudRate, parity })
        resolve({ path: portInfo.path, success: true, msg: `Modbus ${tagName} created and port opened` })
      } catch (error) {
        this.slaves.delete(tagName) // Limpar em caso de erro
        resolve({ path: portInfo.path, success: false, msg: `Failed to create Modbus ${tagName}: ${error.message}` })
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