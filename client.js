import Log from "../script-loader/utils-script.js"
import FWLink from "../daq-fwlink/FWLink.js"
import { RastUtil } from "../rast-pvi/rast-pvi.js"

export class Socket {
    /** retrocompatibilidade */
    static IO = { connected: false };

    static ServerPort = 3000;
    /** @type {WebSocket} */
    static ws = null; // Inicializar como null para evitar criação prematura
    static Error = null;
    static Slaves = null;
    static PortList = null;
    static debugMode = false;
    static OpenPorts = null;
    static ActiveSlaves = null;
    static CriticalErrors = ["Writing to COM port (GetOverlappedResult): Unknown error code 31"];
    static RESPONSE_TIMEOUT = 5000; // Aumentado para 5000ms para evitar timeouts prematuros
    static pendingRequests = new Map();

    static Events = {
        // Global socket commands
        KILL_PROCESS: "kill-process",
        SERVER_ERROR: "server-error",
        PORTLIST_REQ: "port-list-req",
        PORTLIST_RES: "port-list-res",
        OPENPORTS_REQ: "get-openports-req",
        OPENPORTS_RES: "get-openports-res",
        ACTIVE_SLAVE_REQ: "active-slave-req",
        ACTIVE_SLAVE_RES: "active-slave-res",
        // Common serial commands
        OPEN_PORT_REQ: "open-port-req",
        OPEN_PORT_RES: "open-port-res",
        CLOSE_PORT_REQ: "close-port-req",
        CLOSE_PORT_RES: "close-port-res",
        READ_FROM_REQ: "rx-buffer-req",
        READ_FROM_RES: "rx-buffer-res",
        WRITE_TO_REQ: "tx-buffer-req",
        WRITE_TO_RES: "tx-buffer-res",
        // Modbus only commands
        OPEN_MODBUS_REQ: "open-mdb-slave-req",
        OPEN_MODBUS_RES: "open-mdb-slave-res",
        CLOSE_MODBUS_REQ: "close-mdb-slave-req",
        CLOSE_MODBUS_RES: "close-mdb-slave-res",
        FREE_SLAVE_REQ: "free-mdb-slave-req",
        FREE_SLAVE_RES: "free-mdb-slave-res",
        CREATE_MODBUS_REQ: "create-mdb-slave-req",
        CREATE_MODBUS_RES: "create-mdb-slave-res",
        SET_NODE_ADDRESS_REQ: "set-mdb-slave-addr-req",
        SET_NODE_ADDRESS_RES: "set-mdb-slave-addr-res",
        READ_DEVICE_ID_REQ: "read-device-id-req",
        READ_DEVICE_ID_RES: "read-device-id-res",
        READ_INPUT_REGISTERS_REQ: "read-mdb-input-regs-req",
        READ_INPUT_REGISTERS_RES: "read-mdb-input-regs-res",
        READ_HOLDING_REGISTERS_REQ: "read-mdb-holding-regs-req",
        READ_HOLDING_REGISTERS_RES: "read-mdb-holding-regs-res",
        WRITE_HOLDING_REGISTER_REQ: "write-mdb-holding-reg-req",
        WRITE_HOLDING_REGISTER_RES: "write-mdb-holding-reg-res",
        WRITE_HOLDING_REGISTERS_REQ: "write-mdb-holding-regs-req",
        WRITE_HOLDING_REGISTERS_RES: "write-mdb-holding-regs-res",
    };

    static async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    static setCallbacks() {
        if (!this.ws) return

        this.ws.onopen = () => {
            this.IO.connected = true
            console.warn(`🟢 Conectado ao servidor websocket-serialport na porta ${this.ServerPort}`)
        }

        this.ws.onclose = () => {
            this.IO.connected = false
            console.warn(`🔴 Desconectado do servidor na porta ${this.ServerPort}`)
            this.ws = null // Limpar ws para permitir reconexão
        }

        this.ws.onerror = (error) => {
            console.warn(`Erro no WebSocket: ${error.message}`)
            this.IO.connected = false
            // Não rejeitar aqui, pois a reconexão será tentada em sendRequest
        }

        this.ws.onmessage = (event) => {
            try {
                const { data, token } = JSON.parse(event.data)

                // Resolver requisições pendentes
                if (this.pendingRequests.has(token)) {
                    const resolveRequest = this.pendingRequests.get(token)
                    resolveRequest(data)
                    this.pendingRequests.delete(token)
                }
            } catch (error) {
                console.error("Erro ao parsear mensagem JSON:", error)
            }
        }
    }

    static async connect(url = `ws://localhost:${this.ServerPort}`) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.IO.connected = true
            console.warn(`🟢 Serial client already connected`)
            return true
        }

        return new Promise((resolve, reject) => {
            this.IO.connected = false
            this.ws = new WebSocket(url)
            this.setCallbacks()

            this.ws.onopen = () => {
                this.IO.connected = true
                console.warn(`🟢 Conectado ao servidor websocket-serialport na porta ${this.ServerPort}`)
                resolve(true)
            }

            this.ws.onerror = (error) => {
                this.IO.connected = false
                console.warn(`Erro no WebSocket: ${error.message}`)
                reject(error)
            }

            this.ws.onclose = () => {
                this.IO.connected = false
                console.warn(`🔴 Desconectado do servidor na porta ${this.ServerPort}`)
                this.ws = null
                reject(new Error('WebSocket closed'))
            }
        })
    }

    // Função utilitária para enviar requisições e esperar a resposta
    static async sendRequest(requestEvent, data = null, responseEvent = null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            try {
                await this.connect()
            } catch (error) {
                return {
                    success: false,
                    msg: `Failed to connect to WebSocket server: ${error.message}`,
                    path: data?.portInfo?.path || data?.tagName || 'Unknown'
                }
            }
        }

        const token = crypto.randomUUID()

        return new Promise((resolve) => {
            // Armazena a Promise com o token como chave
            this.pendingRequests.set(token, resolve)

            // Envia a mensagem com o token incluído
            const message = { event: requestEvent, token, data }
            this.ws.send(JSON.stringify(message))

            // Lógica de timeout
            setTimeout(() => {
                if (this.pendingRequests.has(token)) {
                    this.pendingRequests.delete(token)
                    resolve({
                        success: false,
                        msg: `Timeout waiting for response to ${requestEvent} (Token: ${token})`,
                        path: data?.portInfo?.path || data?.tagName || 'Unknown'
                    })
                }
            }, this.RESPONSE_TIMEOUT)
        })
    }

    static async getPortList() {
        return await this.sendRequest(this.Events.PORTLIST_REQ, null, this.Events.PORTLIST_RES)
    }

    static async getOpenPorts() {
        return await this.sendRequest(this.Events.OPENPORTS_REQ, null, this.Events.OPENPORTS_RES)
    }

    static async getActiveSlaves() {
        return await this.sendRequest(this.Events.ACTIVE_SLAVE_REQ, null, this.Events.ACTIVE_SLAVE_RES)
    }

    static async startWebsocket() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.IO.connected = true
            console.warn(`✅ Serial Server already running on port ${this.ServerPort}`)
            return { success: true, msg: `Serial Server already running on port ${this.ServerPort}` }
        }

        console.warn(`⚙️ Starting Serial Server on port ${this.ServerPort}`)

        // Iniciar o servidor via FWLink
        FWLink.runInstructionS("EXEC", [
            "node",
            `${RastUtil.getScriptPath()}/node_modules/@libs-scripts-mep/serialport-websocket/server.js ${this.ServerPort}`,
            "true",
            "true"
        ], () => { })

        return Promise.race([
            new Promise((resolve) => {
                FWLink.PVIEventObserver.add(async (message, params) => {
                    const msg = params?.[0]

                    if (this.debugMode && msg.includes("[SERIAL SERVER]")) {
                        console.warn(msg, Log.Colors.Purple.Violet)
                    }

                    if (msg.includes("[SERIAL SERVER]") && msg.includes("Serial WebSocket executando em")) {
                        await this.connect()
                        resolve({ success: true, msg })
                    }
                }, "PVI.Sniffer.sniffer.PID_")
            }),
            new Promise((resolve) =>
                setTimeout(() => {
                    resolve({ success: false, msg: `❌ Serial Server failed to start on port ${this.ServerPort}` })
                }, 10000)
            )
        ])
    }

    static killProcess() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendRequest(this.Events.KILL_PROCESS, null)
        }
    }

    static {
        this.connect()
            .catch(this.startWebsocket())
        window.Socket = this
    }
}