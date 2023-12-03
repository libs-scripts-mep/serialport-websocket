import Log from "../script-loader/utils-script.js"
import FWLink from "../daq-fwlink/FWLink.js"
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js"
import { SocketEvents } from "./server.js"

export class Socket {
    static IO = io('http://localhost:3000')
    static Error = null
    static PortList = null
    static DebugMode = false

    static startObservers() {
        Socket.IO.on(SocketEvents.PORTLIST_RES, (portList) => { console.log(portList); Socket.PortList = portList })
        Socket.IO.on(SocketEvents.SERVER_ERROR, (error) => { console.error(error); Socket.Error = error })

        Socket.IO.on(SocketEvents.OPEN_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(SocketEvents.CLOSE_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(SocketEvents.WRITE_TO_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(SocketEvents.READ_FROM_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
    }

    static getPortList() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(SocketEvents.PORTLIST_REQ)

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
                        `C:/Users/lucas.kroth/Desktop/serialport-websocket/src/server.js`,
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