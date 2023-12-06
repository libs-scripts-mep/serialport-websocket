import { Socket } from "./client.js"

/**
 * 
 * # Exemplos
 * 
 * ```js
 * baudrate: Number
 * tag: String
 * port: Object
 * parity: 'none' | 'even' | 'odd';
 * 
 * const serial = new Serial(9600, "Controller")
 * ```
 * 
 * Passando informações de port na instância:
 * 
 * ```js
 * portList = Socket.getPortList()
 * const serial = new Serial(115200, "Controller", portList[0], 'even')
 * ```
 */
export class Serial {
    constructor(baudrate = 9600, tag = "Serial", port = null, parity = 'none') {
        /** Serve como ID da porta que será persistida no servidor enquanto estiver rodando */
        this.TAG = tag
        /** Informações da porta retornadas pelo OS com `Socket.getPortList()` */
        this.PORT = port
        this.PARITY = parity
        this.BAUDRATE = baudrate

        /** Configurações estéticas para log */
        this.Log = {
            /** Cor que serão apresentadas as requisições no console */
            req: Log.Colors.Blue.CornflowerBlue,
            /** Cor que serão apresentadas as respostas no console */
            res: Log.Colors.Purple.Orchid,
            /** Cor que serão apresentados os erros no console */
            error: Log.Colors.Red.Crimson,
            /** Cor que serão apresentadas as mensagens de sucesso */
            success: Log.Colors.Green.SpringGreen
        }

        this.OpenResult = null
        this.CloseResult = null
        this.WriteResult = null
        this.ReadResult = null

        this.startSocketCallbacks()
    }

    /**Inicializa os callbacks que serão executados quando o servidor websocket responder a partir de um comando */
    startSocketCallbacks() {
        Socket.IO.on(Socket.Events.OPEN_PORT_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.OpenResult = res } } })
        Socket.IO.on(Socket.Events.CLOSE_PORT_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.CloseResult = res } } })
        Socket.IO.on(Socket.Events.WRITE_TO_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteResult = res } } })
        Socket.IO.on(Socket.Events.READ_FROM_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadResult = res } } })
    }

    /**Atualiza as informações da porta serial desta instância */
    setPort(port) { this.PORT = port }

    /**
     * # Exemplos
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.close()
     * ```
     * 
     * # Result
     * 
     * ```js
     * { path: String, success: Boolean, msg: String}
     * ```
     */
    async close() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.CLOSE_PORT_REQ, this.TAG)

            while (this.CloseResult == null) { await SerialUtil.Delay(10) }
            Log.console(this.CloseResult.msg, this.CloseResult.success ? this.Log.success : this.Log.error)

            resolve(this.CloseResult)
            this.CloseResult = null
        })
    }

    /**
     * # Exemplos
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.open()
     * ```
     * 
     * # Result
     * 
     * ```js
     * { path: String, success: Boolean, msg: String}
     * ```
     */
    async open() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.OPEN_PORT_REQ, { portInfo: this.PORT, config: { baudRate: this.BAUDRATE, tagName: this.TAG } })

            while (this.OpenResult == null) { await SerialUtil.Delay(10) }
            Log.console(this.OpenResult.msg, this.OpenResult.success ? this.Log.success : this.Log.error)

            resolve(this.OpenResult)
            this.OpenResult = null
        })
    }

    /**
     * # Exemplos
     * 
     * ### Trabalhando com `hex` representado em `string`
     * 💡 o encoding default é HEX, não é necessário informar
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.read(100)
     * ```
     * 
     * ### Trabalhando com `ASCII`
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.read(50, SerialUtil.Encoders.ASCII)
     * ```
     * 
     * # Result
     * 
     * ```js
     * { path: String, success: Boolean, msg: String}
     * ```
     */
    async read(timeout = null, encoding = SerialUtil.Encoders.HEX) {
        return new Promise(async (resolve) => {
            timeout ? await SerialUtil.Delay(timeout) : null

            Socket.IO.emit(Socket.Events.READ_FROM_REQ, { tagName: this.TAG, encoding })

            while (this.ReadResult == null) { await SerialUtil.Delay(10) }
            this.ReadResult.msg == null ? null : this.ReadResult.msg = this.ReadResult.msg.toUpperCase()
            Log.console(`R ${this.ReadResult.path}: ${this.ReadResult.msg}`, this.ReadResult.success ? this.Log.res : this.Log.error)

            resolve(this.ReadResult)
            this.ReadResult = null
        })
    }

    /**
     * # Exemplos
     * 
     * ### Trabalhando com `hex` representado em `string`
     * 
     * 💡 o encoding default é HEX, não é necessário informar
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.write('aa12ff32ccdd45') 
     * ```
     * 
     * ### Trabalhando com `hex`
     * 
     * 💡 quando enviado buffer de interno, encoding é ignorado no server-side
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.write([0xA6, 0x03, 0x06 ... ]) 
     * 
     * //o buffer abaixo é equivalente:
     * const result = await serial.write([166, 3, 6 ... ]) 
     * ```
     *
     * ### Trabalhando com `ASCII`
     * 
     * ```js
     * const serial = new Serial()
     * const result = await serial.write('my message', SerialUtil.Encoders.ASCII) 
     * ```
     * 
     * # Result
     * 
     * ```js
     * { path: String, success: Boolean, msg: String}
     * ```
     */
    async write(content, encoding = SerialUtil.Encoders.HEX) {
        return new Promise(async (resolve) => {
            if (this.PORT != null) {
                Socket.IO.emit(Socket.Events.WRITE_TO_REQ, { tagName: this.TAG, message: { content, encoding } })

                while (this.WriteResult == null) { await SerialUtil.Delay(10) }
                Log.console(`W ${this.WriteResult.path}: ${this.WriteResult.msg}`, this.WriteResult.success ? this.Log.req : this.Log.error)

                resolve(this.WriteResult)
                this.WriteResult = null
            } else {
                resolve({ path: "Unknown", success: false, msg: "Porta COM não definida para essa instância" })
            }
        })
    }

    /**
     * ```js
     * { request: String, 
     * regex: RegExp, 
     * encoding: String ,
     * readTimeout: Number, 
     * maxTries: Number, 
     * tryNumber: Number }
     * ```
     * 
     * @param {object} reqInfo
     * @returns 
     */
    async reqResMatchBytes(reqInfo) {
        const { regex } = reqInfo
        const { request } = reqInfo
        const { maxTries } = reqInfo
        const { encoding } = reqInfo
        const { tryNumber } = reqInfo
        const { readTimeout } = reqInfo

        try {
            const write = await this.write(request, encoding)
            if (write.success) {

                let response = await this.read(readTimeout, encoding)
                let match = null
                response.msg != null ? match = response.msg.match(regex) : null

                if (match) {
                    return { success: true, response: match, msg: "sucesso na validação do regex" }

                } else if (tryNumber < maxTries) {
                    reqInfo.tryNumber++
                    return this.reqResMatchBytes(reqInfo)

                } else {
                    return { success: false, response: null, msg: "falha na validação do regex" }
                }
            } else {
                return { success: write.success, response: null, msg: write.msg }
            }
        } catch (error) {
            console.error(error)
            return { success: false, response: null, msg: error }
        }
    }
}

/**
 * 
 * # Exemplos
 * 
 * ```js
 * baudrate: Number
 * tag: String
 * port: Object //Opcional
 * parity: 'none' | 'even' | 'odd' //Opcional
 * policy: 'Queue' | 'Stack' //Opcional
 * 
 * const serial = new SerialReqManager(9600, "Controller")
 * ```
 * Adquirindo informações das portas do sistema:
 * 
 * ```js
 * portList = Socket.getPortList()
 * ```
 * ![Image](https://i.imgur.com/uJohcMV.png)
 * 
 * Passando informações de port na instância:
 * 
 * ```js
 * const serial = new SerialReqManager(115200, "Controller", portList[0], 'even')
 * ```
 */
export class SerialReqManager extends Serial {
    constructor(baudrate, tag, port, parity, policy = "Queue") {
        super(baudrate, tag, port, parity)

        /**Permite pausar ou prosseguir com o processamento das requisições. ⚠️ Não impede a inserção de requisições no buffer.*/
        this.Processing = true
        /**Buffer de requisições: é possível monitorar todas as informações de cada requisição inserida. */
        this.ReqBuffer = []
        /**Buffer de respostas: é possível monitorar todas as informações de cada resposta inserida. ⚠️ Após atendida, a resposta é removida do buffer*/
        this.ResBuffer = []
        /**Determina a politica de gerenciamento das requisições entre `fila` ou `pilha`*/
        this.policyManagement = policy
        /**Determina o intervalo em que as requisições serão processadas. */
        this.ManagerInterval = 50

        this.Manager()
    }

    async Manager() {
        if (this.hasReqToSend() && this.Processing) {

            const nextReq = this.GetReq()
            const result = await this.reqResMatchBytes(nextReq)

            nextReq["matchResult"] = result.response
            nextReq["response"] = result.response == null ? "" : result.response[0]
            nextReq["success"] = result.success

            this.ResBuffer.push(nextReq)
            this.Manager()

        } else {
            setTimeout(() => {
                this.Manager()
            }, this.ManagerInterval)
        }
    }

    hasReqToSend() {
        return this.ReqBuffer.length > 0
    }

    /**
     * 
     * @returns requisicao: object
     * 
     * Baseado na politica de gerenciamento: "Stack", ou "Queue"
     */
    GetReq() {
        if (this.policyManagement == "Queue") {
            return this.ReqBuffer.splice(0, 1)[0]
        } else if (this.policyManagement == "Stack") {
            return this.ReqBuffer.pop()
        } else {
            console.warn(`Invalid policy management assignment!\n\n
         Allowed: 'Queue' and 'Stack'\n\n
         Assigned: ${this.policyManagement}`)
        }
    }

    /**
     * Insere requisicao no buffer de requisicoes
     * @param {object} reqInfo
     * @returns String
     */
    InsertReq(reqInfo) {
        reqInfo.readTimeout ||= 50
        reqInfo.tryNumber ||= 1
        reqInfo.encoding ||= SerialUtil.Encoders.HEX
        reqInfo.maxTries ||= 5
        reqInfo["id"] = crypto.randomUUID()
        this.ReqBuffer.push(reqInfo)
        return reqInfo.id
    }

    /**
     * Busca e remove do buffer de respostas uma resposta baseado no UUID
     * @param {string} searchID 
     * @returns Object
     */
    SearchRes(searchID) {
        let obj = null

        this.ResBuffer.forEach((reqInfo, pos) => {
            const { id } = reqInfo
            if (id == searchID) {
                obj = reqInfo
                const removeRes = this.ResBuffer.splice(pos, 1)
            }
        })
        return obj
    }


    /**
     * Insere um objeto na pilha ou fila do gerenciador, e retorno um objeto com as adquiridas.
     * 
     * @param {Object} reqInfo 
     * @returns Object
     * 
     * # Exemplos
     * 
     * ```js
     * const reqInfo = {
     * request: String
     * regex: RegExp
     * encoding: String,
     * readTimeout: Number //Opcional
     * tryNumber: Number //Opcional
     * maxTries: Number //Opcional
     * }
     * const serial = new SerialReqMenager(9600)
     * const result = await serial.WatchForResponse(reqInfo)
     * ```
     * ## Result
     * 
     * ```js
     * {id: String,
     *  maxTries: Number,
     *  readTimeout: Number,
     *  regex: RegExp,
     *  request: String,
     *  encoding: String,
     *  matchResult: Array,
     *  response: String,
     *  success: Boolean,
     *  tryNumber: Number}
     * ```
     */
    async WatchForResponse(reqInfo) {
        return new Promise((resolve) => {
            const id = this.InsertReq(reqInfo)

            const monitor = setInterval(() => {
                const obj = this.SearchRes(id)
                if (obj != null) {
                    clearInterval(monitor)
                    resolve(obj)
                }
            }, 50)
        })
    }

    /**
     * 
     * @param {object} reqInfo
     * @returns 
     * 
     * # Exemplos
     * 
     * ```js
     * const reqInfo = {
     * request: String
     * regex: RegExp
     * readTimeout: Number //Opcional
     * tryNumber: Number //Opcional
     * maxTries: Number //Opcional
     * }
     * const serial = new SerialReqMenager(9600)
     * const result = await serialInstance.portDiscover(reqInfo)
     * ```
     * ## Result
     * 
     * ```js
     * {success: Boolean, port: String}
     * ```
     */
    async portDiscover(reqInfo, filter) {

        const portList = await Socket.getPortList()
        const filteredProps = SerialUtil.filterByProps(portList, filter)
        filteredProps.length == 0 ? filteredProps[0] = portList : null

        if (filteredProps.length > 0) {

            for (const filteredPortList of filteredProps) {
                for (const port of filteredPortList) {

                    this.setPort(port)
                    reqInfo.tryNumber = 1

                    const openResult = await this.open()
                    if (openResult.success) {

                        const result = await this.WatchForResponse(reqInfo)

                        if (result.success) { return { success: true, port: this.PORT, msg: "Sucesso ao descobrir porta serial" } }
                        else { await this.close() }
                    }
                    await SerialUtil.Delay(20)
                }
            }

            this.setPort(null)
            return { success: false, port: this.PORT, msg: "Nenhuma porta serial respondeu à requisição" }

        } else {
            this.setPort(null)
            return { success: false, port: this.PORT, msg: "Não há nenhuma porta serial para se conectar" }
        }
    }
}

window.SerialReqManager = SerialReqManager

export class SerialUtil {

    static Encoders = {
        HEX: "hex",
        UTF8: "utf8",
        ASCII: "ascii",
        BINARY: "binary",
    }

    static DataTypes = {
        BYTE: 2,
        WORD: 4,
        DWORD: 8
    }

    static async Delay(timeout) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve()
            }, timeout)
        })
    }

    static filterByProps(array, filterObject = {}) {
        const result = []
        for (const [filter, value] of Object.entries(filterObject)) {
            result.push(array.filter((item) => item[filter] == value))
        }
        return result
    }

    static hexStrToIntBuff(hexStr, size) {
        const result = []
        if (hexStr != null) {
            while (hexStr.length >= size) {
                result.push(parseInt(hexStr.substring(0, size), 16))
                hexStr = hexStr.substring(size, hexStr.length)
            }
        }
        return result
    }

    static intBuffToStr(buffer, size = SerialUtil.DataTypes.BYTE, separator = " ") {
        const result = []
        if (buffer != null) {
            for (const data of buffer) {
                result.push(data.toString(16).toUpperCase().padStart(size, '0'))
            }
            return result.join(separator)
        }
        return ""
    }

    static { window.SerialUtil = SerialUtil }
}