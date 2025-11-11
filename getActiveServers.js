// getActiveServers.js
import axios from "axios";
import WebSocket from "ws";

let sos_loaded_at_mtm = -1;

/**
 * Fetch the slither.io server list and return only active servers.
 * @returns {Promise<Array<{ip:string,po:number,clu:number,ac:number,sid:number,active:boolean}>>}
 */
export async function getActiveServers() {
    try {
        const response = await axios.get("https://slither.io/i80124.txt", {
            responseType: "text",
        });
        const text = response.data;
        return parseServers(text);
    } catch (err) {
        console.error("Failed to fetch server list:", err.message);
        return [];
    }
}

function parseServers(s) {
    if (!s || !s.length) return [];

    const sos = [];
    const clus = [];
    const ala = s.charAt(0) == "a";
    let j = 1;
    let o = {};
    let m = 0;
    let n = 0;
    let v;
    let cv = 0;
    let cav = 0;
    let ia = [];
    let i6a = [];
    let pa = [];
    let aa = [];
    let clu = [];
    let sida = [];
    let active;

    while (j < s.length) {
        v = (s.charCodeAt(j++) - 97 - cav) % 26;
        if (v < 0) v += 26;
        cv *= 16;
        cv += v;
        cav += 7;
        if (n == 1) {
            if (m == 0) {
                active = cv <= 26;
                m++;
            } else if (m == 1) {
                ia.push(cv);
                if (ia.length == 4) m++;
            } else if (m == 2) {
                i6a.push(cv);
                if (i6a.length == 16) m++;
            } else if (m == 3) {
                pa.push(cv);
                if (pa.length == 2) m++;
            } else if (m == 4) {
                aa.push(cv);
                if (aa.length == 2) m++;
            } else if (m == 5) {
                clu.push(cv);
                if (clu.length == 1) m++;
            } else if (m == 6) {
                sida.push(cv);
                if (sida.length == 2) {
                    const po = pa.reduce((acc, v) => acc * 256 + v, 0);
                    const ac = aa.reduce((acc, v) => acc * 256 + v, 0);
                    const sid = sida.reduce((acc, v) => acc * 256 + v, 0);

                    for (let z = 1; z <= 2; z++) {
                        o = {};
                        if (z == 1) o.ip = ia.join(".");
                        else if (i6a.length == 16) {
                            const fip6 = [];
                            let gg = false;
                            for (let k = 0; k < i6a.length; k += 2) {
                                const q = i6a[k] * 256 + i6a[k + 1];
                                if (q != 0) gg = true;
                                fip6.push(q.toString(16));
                            }
                            if (!gg) break;
                            o.ip = "[" + fip6.join(":") + "]";
                        } else break;

                        o.po = po;
                        o.ac = ac;
                        o.sid = sid;
                        o.active = active;
                        o.wg = ac + 5;
                        o.clu = z == 1 ? clu[0] : clu[0] + 1e3;

                        let cluo = clus[o.clu];
                        if (!cluo) {
                            cluo = { sis: [], ptms: [], swg: 0, tac: 0, sos: [] };
                            clus[o.clu] = cluo;
                        }
                        o.cluo = cluo;
                        if (o.active) cluo.swg += o.wg;
                        cluo.sos.push(o);
                        cluo.tac += ac;
                        sos.push(o);
                    }
                    ia = [];
                    i6a = [];
                    pa = [];
                    aa = [];
                    clu = [];
                    sida = [];
                    m = 0;
                }
            }
            cv = 0;
            n = 0;
        } else n++;
    }

    sos_loaded_at_mtm = Date.now();
    return sos.filter((srv) => srv.active);
}
