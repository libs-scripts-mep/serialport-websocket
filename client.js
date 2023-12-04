import Log from "../script-loader/utils-script.js"
import { RastUtil } from "../rast-pvi/rast-pvi.js"
import FWLink from "../daq-fwlink/FWLink.js"
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js"

export class Socket {
    static IO = io('http://localhost:3000')
    static Error = null
    static PortList = null
    static DebugMode = false

    static Events = {
        PORTLIST_REQ: "port-list-req",
        PORTLIST_RES: "port-list-res",
        OPEN_PORT_REQ: "open-port-req",
        OPEN_PORT_RES: "open-port-res",
        CLOSE_PORT_REQ: "close-port-req",
        CLOSE_PORT_RES: "close-port-res",
        READ_FROM_REQ: "rx-buffer-req",
        READ_FROM_RES: "rx-buffer-res",
        WRITE_TO_REQ: "tx-buffer-req",
        WRITE_TO_RES: "tx-buffer-res",
        SERVER_ERROR: "server-error",
    }

    static startObservers() {
        Socket.IO.on(Socket.Events.PORTLIST_RES, (portList) => { console.log(portList); Socket.PortList = portList })
        Socket.IO.on(Socket.Events.SERVER_ERROR, (error) => { console.error(error); Socket.Error = error })

        Socket.IO.on(Socket.Events.OPEN_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.CLOSE_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.WRITE_TO_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.READ_FROM_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
    }

    static getPortList() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.PORTLIST_REQ)

            while (this.PortList == null) { await SerialUtil.Delay(10) }

            resolve(this.PortList)
            this.PortList = null
        })
    }

    static {
        window.Socket = Socket
        Socket.startObservers()

        setTimeout(() => {
            if (!Socket.IO.connected) {
                FWLink.runInstructionS("EXEC",
                    [
                        "node",
                        `${RastUtil.getScriptPath()}/node_modules/@libs-scripts-mep/serialport-websocket/server.js`,
                        "true",
                        "true"
                    ],
                    () => { }
                )
            }
            FWLink.PVIEventObserver.add((message, params) => {
                if (params[0] != undefined && Socket.DebugMode) {
                    Log.console(params[0], Log.Colors.Purple.MediumPurple)
                }
            }, "PVI.Sniffer.sniffer.exec_return.data")
        }, 1000)
    }
}