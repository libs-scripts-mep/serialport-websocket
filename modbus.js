import { Socket } from "./client.js"
import { SerialReqManager, SerialUtil } from "./serial.js"

/**
 * A classe Modbus estende SerialReqManager para gerenciar comunicação com dispositivos Modbus.
 * Herda funcionalidades de gerenciamento de requisições seriais e adiciona métodos específicos para Modbus.
 */
export class Modbus extends SerialReqManager {
    constructor(baudrate = 9600, tag = "Modbus", port = null, parity = 'none', policy = "Queue") {
        super(baudrate, tag, port, parity, policy)
        this.name = null
        this.NodeAddress = null
        this.requestQueue = [] // Fila de requisições
        this.isProcessing = false // Controle de processamento da fila
    }

    // Processa a próxima requisição na fila
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return
        }

        this.isProcessing = true
        const { request, resolve, reject } = this.requestQueue.shift()

        try {
            const result = await request()
            resolve(result)
        } catch (error) {
            reject(error)
        } finally {
            this.isProcessing = false
            this.processQueue() // Processa a próxima requisição
        }
    }

    // Enfileira uma requisição
    enqueueRequest(request) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ request, resolve, reject })
            this.processQueue()
        })
    }

    /**
     * Transforma uma instância serial em um dispositivo Modbus (server-side).
     * * ⚠️ Após a transformação, a instância serial não estará disponível para uso.
     * * ⚠️ Após criar o slave, a porta permanecerá aberta, não sendo necessário abri-la manualmente.
     *
     * @returns {Promise<{success: boolean, msg: string}>}
     * * @example
     * const mdb = new Modbus();
     * await mdb.create();
     */
    async create() {
        return this.enqueueRequest(async () => {
            let result = await Socket.sendRequest(
                Socket.Events.CREATE_MODBUS_REQ,
                { portInfo: this.PORT, config: { baudRate: this.BAUDRATE, parity: this.PARITY, tagName: this.TAG } },
                Socket.Events.CREATE_MODBUS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Creating Modbus ${this.PORT?.path || "Unknown"}: Falha ao criar slave (timeout)`
                }
            }

            Log.console(
                `MDB ${this.PORT == null ? "?" : this.PORT.path}: ${result.msg}`,
                result.success ? this.Log.success : this.Log.error
            )

            return result
        })
    }

    /**
     * Abre a porta serial do dispositivo Modbus.
     *
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * * @example
     * const modbus = new Modbus();
     * await modbus.create();
     * await modbus.closeSlave();
     * await modbus.openSlave();
     */
    async openSlave() {
        return this.enqueueRequest(async () => {
            let result = await Socket.sendRequest(
                Socket.Events.OPEN_MODBUS_REQ,
                { tagName: this.TAG },
                Socket.Events.OPEN_MODBUS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Opening Modbus ${this.PORT?.path || "Unknown"} ${this.TAG}: Falha ao abrir slave (timeout)`
                }
            }

            Log.console(
                `MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${result.msg}`,
                result.success ? this.Log.success : this.Log.error
            )

            return result
        })
    }

    /**
     * Fecha a porta serial do dispositivo Modbus.
     *
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * * @example
     * const modbus = new Modbus();
     * await modbus.create();
     * await modbus.closeSlave();
     */
    async closeSlave() {
        return this.enqueueRequest(async () => {
            let result = await Socket.sendRequest(
                Socket.Events.CLOSE_MODBUS_REQ,
                { tagName: this.TAG },
                Socket.Events.CLOSE_MODBUS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Closing Modbus ${this.PORT?.path || "Unknown"} ${this.TAG}: Falha ao fechar slave (timeout)`
                }
            }

            Log.console(
                `MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${result.msg}`,
                result.success ? this.Log.success : this.Log.error
            )

            return result
        })
    }

    /**
     * Libera o slave, permitindo transformá-lo novamente em uma instância serial comum.
     * * ⚠️ Após liberar o slave, não será possível continuar comunicando.
     *
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * * @example
     * const mdb = new Modbus();
     * await mdb.create();
     * const result = await mdb.freeSlave();
     */
    async freeSlave() {
        return this.enqueueRequest(async () => {
            let result = await Socket.sendRequest(
                Socket.Events.FREE_SLAVE_REQ,
                { tagName: this.TAG },
                Socket.Events.FREE_SLAVE_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Freeing Modbus ${this.PORT?.path || "Unknown"} ${this.TAG}: Falha ao liberar slave (timeout)`
                }
            }

            Log.console(
                `MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${result.msg}`,
                result.success ? this.Log.success : this.Log.error
            )

            return result
        })
    }

    /**
     * Define o node address para o dispositivo Modbus.
     *
     * @param {number} nodeAddress - O novo node address a ser definido.
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * * @example
     * const mdb = new Modbus();
     * await mdb.create();
     * const result = await mdb.setNodeAddress(1);
     */
    async setNodeAddress(nodeAddress) {
        return this.enqueueRequest(async () => {
            let result = await Socket.sendRequest(
                Socket.Events.SET_NODE_ADDRESS_REQ,
                { nodeAddress, tagName: this.TAG },
                Socket.Events.SET_NODE_ADDRESS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Setting node address for ${this.PORT?.path || "Unknown"} ${this.TAG}: Falha ao definir endereço (timeout)`
                }
            }

            if (result.success) {
                this.NodeAddress = result.addr
            }

            Log.console(
                `MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${result.msg}`,
                result.success ? this.Log.success : this.Log.error
            )

            return result
        })
    }

    /**
     * Lê assincronamente a identificação do dispositivo.
     *
     * @param {number} idCode - O código de identificação.
     * @param {number} objectId - O ID do objeto.
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     */
    async ReadDeviceIdentification(idCode, objectId) {
        return this.enqueueRequest(async () => {
            Log.console(
                `MDB F43 ${this.PORT == null ? "?" : this.PORT.path} ${this.name || this.TAG}: idCode => ${idCode} objectId => ${objectId}`,
                this.Log.req
            )

            let result = await Socket.sendRequest(
                Socket.Events.READ_DEVICE_ID_REQ,
                { idCode, objectId, tagName: this.TAG },
                Socket.Events.READ_DEVICE_ID_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Reading device ID for ${this.PORT?.path || "Unknown"} ${this.name || this.TAG}: Falha ao ler identificação (timeout)`
                }
            }

            result.success ? console.log(result.msg) : console.error(result.msg)
            return result
        })
    }

    /**
     * Lê assincronamente registros de entrada do dispositivo Modbus.
     *
     * @param {number} startAddress - O endereço inicial dos registros de entrada.
     * @param {number} qty - A quantidade de registros de entrada a ler.
     * @param {number} [tryNumber=1] - O número atual de tentativas.
     * @param {number} [maxTries=3] - O número máximo de tentativas.
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * * @example
     * const modbus = new Modbus();
     * const result = await modbus.ReadInputRegisters(0, 10);
     */
    async ReadInputRegisters(startAddress, qty, tryNumber = 1, maxTries = 3) {
        return this.enqueueRequest(async () => {
            Log.console(
                `MDB F04 ${this.PORT == null ? "?" : this.PORT.path} ${this.name || this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`,
                this.Log.req
            )

            let result = await Socket.sendRequest(
                Socket.Events.READ_INPUT_REGISTERS_REQ,
                { startAddress, qty, tagName: this.TAG },
                Socket.Events.READ_INPUT_REGISTERS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Reading input registers for ${this.PORT?.path || "Unknown"} ${this.name || this.TAG}: Falha ao ler registros (timeout)`
                }
            }

            result.success ? console.log(result.msg) : console.error(result.msg)

            if (result.success) {
                return result
            } else if (tryNumber < maxTries) {
                return await this.ReadInputRegisters(startAddress, qty, tryNumber + 1, maxTries)
            } else {
                return result
            }
        })
    }

    /**
     * Lê registros de retenção de um dispositivo Modbus.
     *
     * @param {number} startAddress - O endereço inicial dos registros de retenção.
     * @param {number} qty - A quantidade de registros de retenção a ler.
     * @param {number} [tryNumber=1] - O número de tentativas realizadas até o momento.
     * @param {number} [maxTries=3] - O número máximo de tentativas permitidas.
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve com o resultado da operação de leitura.
     * * @example
     * const modbus = new Modbus();
     * const { success, msg } = await modbus.ReadHoldingRegisters(0, 10);
     */
    async ReadHoldingRegisters(startAddress, qty, tryNumber = 1, maxTries = 3) {
        return this.enqueueRequest(async () => {
            Log.console(
                `MDB F03 ${this.PORT == null ? "?" : this.PORT.path} ${this.name || this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`,
                this.Log.req
            )

            let result = await Socket.sendRequest(
                Socket.Events.READ_HOLDING_REGISTERS_REQ,
                { startAddress, qty, tagName: this.TAG },
                Socket.Events.READ_HOLDING_REGISTERS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Reading holding registers for ${this.PORT?.path || "Unknown"} ${this.name || this.TAG}: Falha ao ler registros (timeout)`
                }
            }

            result.success ? console.log(result.msg) : console.error(result.msg)

            if (result.success) {
                return result
            } else if (tryNumber < maxTries) {
                return await this.ReadHoldingRegisters(startAddress, qty, tryNumber + 1, maxTries)
            } else {
                return result
            }
        })
    }

    /**
     * Escreve um único registro em um dispositivo Modbus.
     *
     * @param {number} startAddress - O endereço inicial do registro.
     * @param {number} value - O valor a ser escrito no registro.
     * @param {number} [tryNumber=1] - O número de tentativas realizadas até o momento.
     * @param {number} [maxTries=3] - O número máximo de tentativas permitidas.
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * * @example
     * const mdb = new Modbus(9600, "MDB");
     * const { success, msg } = await mdb.WriteSingleRegister(0x00, 0x01);
     */
    async WriteSingleRegister(startAddress, value, tryNumber = 1, maxTries = 3) {
        return this.enqueueRequest(async () => {
            Log.console(
                `MDB F06 ${this.PORT == null ? "?" : this.PORT.path} ${this.name || this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) value => ${value}`,
                this.Log.req
            )

            let result = await Socket.sendRequest(
                Socket.Events.WRITE_HOLDING_REGISTER_REQ,
                { startAddress, value, tagName: this.TAG },
                Socket.Events.WRITE_HOLDING_REGISTER_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Writing single register for ${this.PORT?.path || "Unknown"} ${this.name || this.TAG}: Falha ao escrever registro (timeout)`
                }
            }

            result.success ? console.log(result.msg) : console.error(result.msg)

            if (result.success) {
                return result
            } else if (tryNumber < maxTries) {
                return await this.WriteSingleRegister(startAddress, value, tryNumber + 1, maxTries)
            } else {
                return result
            }
        })
    }

    /**
     * Escreve múltiplos registros assincronamente.
     *
     * @param {number} startAddress - O endereço inicial para escrita dos registros.
     * @param {Array} arrValues - Um array de valores a serem escritos.
     * @param {number} [tryNumber=1] - O número de tentativas realizadas.
     * @param {number} [maxTries=3] - O número máximo de tentativas.
     * @returns {Promise<{success: boolean, msg: string}>} Uma promessa que resolve com o resultado da escrita de múltiplos registros.
     * * @example
     * const mdb = new Modbus(9600, "MDB");
     * const { success, msg } = await mdb.WriteMultipleRegisters(0x00, [0x01, 0x02]);
     */
    async WriteMultipleRegisters(startAddress, arrValues, tryNumber = 1, maxTries = 3) {
        return this.enqueueRequest(async () => {
            Log.console(
                `MDB F16 ${this.PORT == null ? "?" : this.PORT.path} ${this.name || this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) arrValues => [${arrValues}]`,
                this.Log.req
            )

            let result = await Socket.sendRequest(
                Socket.Events.WRITE_HOLDING_REGISTERS_REQ,
                { startAddress, arrValues, tagName: this.TAG },
                Socket.Events.WRITE_HOLDING_REGISTERS_RES
            )

            if (result == null) {
                result = {
                    success: false,
                    path: this.PORT?.path || "Unknown",
                    msg: `Writing multiple registers for ${this.PORT?.path || "Unknown"} ${this.name || this.TAG}: Falha ao escrever registros (timeout)`
                }
            }

            result.success ? console.log(result.msg) : console.error(result.msg)

            if (result.success) {
                return result
            } else if (tryNumber < maxTries) {
                return await this.WriteMultipleRegisters(startAddress, arrValues, tryNumber + 1, maxTries)
            } else {
                return result
            }
        })
    }
}