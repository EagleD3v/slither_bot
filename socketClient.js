import WebSocket from "ws";
import { createCanvas, loadImage } from "canvas";
import fs from 'node:fs';

let overlayImagePromise = null;
async function getOverlayImage() {
    if (!overlayImagePromise) {
        const overlayBase64 = "data:image/png;base64,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";
        overlayImagePromise = loadImage(overlayBase64);
    }
    return overlayImagePromise;
}

function drawDynamicMinimapBackground(size) {
    const rad = size / 2;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    const xx = rad;
    const yy = rad;

    // === Layer 1: outer circular shadowed background ===
    ctx.save();
    ctx.fillStyle = "#202630";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.shadowColor = "#000000";
    ctx.beginPath();
    ctx.arc(xx, yy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // === Layer 2: lighter arcs ===
    ctx.fillStyle = "#404650";
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.arc(xx, yy, rad, 0, Math.PI / 2);
    ctx.lineTo(xx, yy);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.arc(xx, yy, rad, Math.PI, 1.5 * Math.PI);
    ctx.lineTo(xx, yy);
    ctx.fill();

    // === Layer 3: crosshairs ===
    ctx.strokeStyle = "#202630";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xx, yy - rad);
    ctx.lineTo(xx, yy + rad);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(xx - rad, yy);
    ctx.lineTo(xx + rad, yy);
    ctx.stroke();

    return canvas;
}

// === Globals for Slither.io score math ===
let fmlts = [];
let fpsls = [];
let mscps = 0;

function setMscps(nmscps) {
    if (nmscps !== mscps) {
        mscps = nmscps;
        fmlts = [];
        fpsls = [];
        for (let i = 0; i <= mscps; i++) {
            if (i >= mscps)
                fmlts.push(fmlts[i - 1]);
            else
                fmlts.push(Math.pow(1 - i / mscps, 2.25));

            if (i === 0)
                fpsls.push(0);
            else
                fpsls.push(fpsls[i - 1] + 1 / fmlts[i - 1]);
        }
        const t_fmlt = fmlts[fmlts.length - 1];
        const t_fpsl = fpsls[fpsls.length - 1];
        for (let i = 0; i < 2048; i++) {
            fmlts.push(t_fmlt);
            fpsls.push(t_fpsl);
        }

    }
}

export class SocketClient {
    constructor(url, options = {}) {
        this.url = url;
        this.agent = options.agent ?? null;
        this.proxyLabel = options.proxyLabel ?? null;
        this.idba = new Uint8Array(0);
        this._resolveStats = null;
        this._rejectStats = null;
        this._statsTimeout = null;
        this._completed = false;
        this._pendingSuccess = null;
        this._pendingFailure = null;
        this.connect();
    }

    connect() {
        const wsOptions = {
            headers: {
                "accept-encoding": "gzip, deflate",
                "accept-language": "en-US,en;q=0.9,de;q=0.8,tr;q=0.7,es;q=0.6,th;q=0.5,ru;q=0.4,pl;q=0.3,ko;q=0.2,ja;q=0.1,zh-CN;q=0.1,zh;q=0.1,hu;q=0.1,fr;q=0.1,it;q=0.1",
                "cache-control": "no-cache",
                "origin": "http://slither.com",
                "pragma": "no-cache",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 OPR/122.0.0.0"
            }
        };

        if (this.agent) {
            wsOptions.agent = this.agent;
        }

        this.ws = new WebSocket(this.url, wsOptions);
        this.ws.binaryType = "arraybuffer";
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);
    }

    onOpen() {
        var a = new Uint8Array(1);
        a[0] = 1;
        this.send(a);

        var cstr = "c";
        var len = cstr.length;
        var a = new Uint8Array(len + 1);
        for (var i = 0; i < len; i++) a[i] = cstr.charCodeAt(i);
        this.send(a);
    }

    returnStatsPromise() {
        return new Promise((resolve, reject) => {
            if (this._pendingFailure) {
                const error = this._pendingFailure;
                this._pendingFailure = null;
                return reject(error);
            }

            if (this._pendingSuccess) {
                const payload = this._pendingSuccess;
                this._pendingSuccess = null;
                return resolve(payload);
            }

            if (this._completed) {
                return reject(new Error("Socket client has already completed."));
            }

            this._resolveStats = resolve;
            this._rejectStats = reject;

            // Optional safety timeout in case server never responds
            this._statsTimeout = setTimeout(() => {
                this._fail(new Error("Timed out waiting for stats"));
            }, 15000);
        });
    }

    _succeed(payload) {
        if (this._completed) return;
        this._completed = true;
        if (this._statsTimeout) {
            clearTimeout(this._statsTimeout);
            this._statsTimeout = null;
        }
        this._pendingFailure = null;
        if (this._resolveStats) {
            this._resolveStats(payload);
        } else {
            this._pendingSuccess = payload;
        }
        this._resolveStats = null;
        this._rejectStats = null;
        this.close();
    }

    _fail(error) {
        if (this._completed) return;
        this._completed = true;
        const failure = error instanceof Error ? error : new Error(String(error || "Unknown error"));
        if (this._statsTimeout) {
            clearTimeout(this._statsTimeout);
            this._statsTimeout = null;
        }
        this._pendingSuccess = null;
        if (this._rejectStats) {
            this._rejectStats(failure);
        } else {
            this._pendingFailure = failure;
        }
        this._resolveStats = null;
        this._rejectStats = null;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            try {
                this.ws.close();
            } catch (closeError) {
                // ignore close errors
            }
        }
    }

    onMessage(event) {
        //console.log(`[Message]`, event.data);

        var want_etm_s = false;

        const a = new Uint8Array(event.data);
        let m = 0;

        // Skip first 2 bytes if they're used for timing or sequence
        if (want_etm_s) m = 2;

        if (a[m] < 32) {
            const l = a.length;
            while (m < l) {
                let len;
                if (a[m] < 32) {
                    len = (a[m] << 8) | a[m + 1];
                    m += 2;
                } else {
                    len = a[m] - 32;
                    m++;
                }

                const a2 = a.subarray(m, m + len);
                m += len;
                this.gotPacket(a2);
            }
        } else {
            const a2 = a.subarray(m, a.length);
            this.gotPacket(a2);
        }
    }

    async gotPacket(a) {
        var cmd;
        var cmd_v;
        var m;
        var alen, plen, dlen;
        cmd_v = a[0];
        cmd = String.fromCharCode(cmd_v);
        alen = a.length;
        plen = a.length;
        dlen = a.length - 1;
        m = 1;

        //console.log(cmd);

        if (cmd === "a") {
            const grd = (a[m] << 16) | (a[m + 1] << 8) | a[m + 2];
            m += 3;

            const nmscps = (a[m] << 8) | a[m + 1];
            m += 2;
            setMscps(nmscps); // 🔥 Critical for accurate leaderboard scores

            const sector_size = (a[m] << 8) | a[m + 1];
            m += 2;

            const sector_count_along_edge = (a[m] << 8) | a[m + 1];
            m += 2;

            const spangdv = a[m] / 10;
            m++;

        } else if (cmd == "6") {
            var s = "";
            while (m < alen) {
                s += String.fromCharCode(a[m]);
                m++;
            }
            this.gotServerVersion(s);
        } else if (cmd == "U") {
        } else if (cmd == "L") {
        } else if (cmd == "M") {

            let sz = (a[m] << 8) | a[m + 1];
            m += 2;
            if (sz > 512) sz = 512;

            const mmsz = sz;
            const bgCanvas = drawDynamicMinimapBackground(mmsz);
            const canvas = createCanvas(mmsz, mmsz);
            const ctx = canvas.getContext("2d");

            // draw background first
            ctx.drawImage(bgCanvas, 0, 0);

            // decode & draw pixels
            const BIT_MASKS = [64, 32, 16, 8, 4, 2, 1];
            let xx = mmsz - 1;
            let yy = mmsz - 1;
            ctx.fillStyle = "#696F74";

            while (m < alen) {
                if (yy < 0) break;
                let k = a[m++];
                if (k >= 128) {
                    if (k === 255) {
                        if (m >= alen) break;
                        k = 126 * a[m++];
                    } else k -= 128;

                    for (let i = 0; i < k; i++) {
                        xx--;
                        if (xx < 0) {
                            xx = mmsz - 1;
                            yy--;
                            if (yy < 0) break;
                        }
                    }
                } else {
                    for (let i = 0; i < 7; i++) {
                        if ((k & BIT_MASKS[i]) > 0) ctx.fillRect(xx, yy, 1, 1);
                        xx--;
                        if (xx < 0) {
                            xx = mmsz - 1;
                            yy--;
                            if (yy < 0) break;
                        }
                    }
                }
            }

            this._minimapBase64 = canvas.toDataURL("image/png");
            this._maybeWriteJSON();
        } else if (cmd == "u") {
        } else if (cmd === "l") {
            const lb = [];
            let mpos = a[m++];
            const rank = (a[m] << 8) | a[m + 1];
            m += 2;
            const totalPlayers = (a[m] << 8) | a[m + 1];
            m += 2;

            let pos = 0;

            while (m < a.length) {
                if (m + 7 >= a.length) break;

                const sct = (a[m] << 8) | a[m + 1];
                m += 2;

                const fam = ((a[m] << 16) | (a[m + 1] << 8) | a[m + 2]) / 16777215;
                m += 3;

                // 🔥 Accurate Slither.io formula using tables from setMscps()
                const score = Math.floor((fpsls[sct] + fam / fmlts[sct] - 1) * 15 - 5);

                const cv = a[m++] % 9;
                const nl = a[m++];
                pos++;

                let name = "";
                for (let j = 0; j < nl && m < a.length; j++) {
                    name += String.fromCharCode(a[m++]);
                }

                lb.push({
                    rank: pos,
                    name: name.trim() || "(unnamed)",
                    score,
                    colorIndex: cv
                });
            }


            const totalScore = lb.reduce((sum, e) => sum + e.score, 0);

            // === JSON output ===
            this._leaderboardData = {
                totalPlayers,
                rank,
                totalScore,
                leaderboard: lb
            };
            this._maybeWriteJSON();
        }
    }

    _maybeWriteJSON() {
        if (this._leaderboardData && this._minimapBase64) {
            const payload = {
                ...this._leaderboardData,
                minimap: this._minimapBase64,
                timestamp: new Date().toISOString()
            };

            this._succeed(payload);
        }
    }

    gotServerVersion(server_version) {
        let random_id = "";
        for (var i = 0; i < 27; i++)
            random_id += String.fromCharCode(65 + (Math.random() < .5 ? 0 : 32) + Math.floor(Math.random() * 26));
        this.idba = new Uint8Array(random_id.length);
        for (var i = 0; i < random_id.length; i++)
            this.idba[i] = random_id.charCodeAt(i);
        if (this.isValidVersion(server_version)) {
            this.send(this.idba);
            this.clientInit();
        }
    }

    isValidVersion(c) {
        for (var a = "", d = 0, e = 23, b, f = 0, g = 0; g < c.length;)
            ((b = c.charCodeAt(g)),
                g++,
                96 >= b && (b += 32),
                (b = (b - 97 - e) % 26),
                0 > b && (b += 26),
                (d *= 16),
                (d += b),
                (e += 17),
                1 == f ? ((a += String.fromCharCode(d)), (f = d = 0)) : f++);


        const { str, count } = this.extractStringAndNumber(a);
        for (var i = 0; i < count; i++) {
            this.idba[i] = str.charCodeAt(i);
        }

        var b = 0;
        for (var d, a, e, c = 0; c < this.idba.length; c++)
            ((d = 65),
                (a = this.idba[c]),
                97 <= a && ((d += 32), (a -= 32)),
                (a -= 65),
                0 == c && (b = 3 + a),
                (e = a + b),
                (e %= 26),
                (b += 2 + a),
                (this.idba[c] = e + d));

        for (a = 0; a < c.length; a++)
            if (((b = c.charCodeAt(a)), 65 > b || 122 < b)) return !1;
        return !0;
    }

    extractStringAndNumber(src) {
        if (typeof src !== 'string') throw new TypeError('src must be a string');

        // 1) Find initial `var a = '...';` (supports single, double, or backtick quotes)
        const initRe = /var\s+a\s*=\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/;
        const initMatch = src.match(initRe);

        // 2) Collect concatenations: `a += '...'` or `a = a + '...'`
        const concatRe = /(?:\ba\s*\+=\s*|(?:\ba\s*=\s*a\s*\+\s*))(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

        let assembled = null;
        if (initMatch) {
            assembled = initMatch[2] || '';
            // append every concatenation in order
            let m;
            while ((m = concatRe.exec(src)) !== null) {
                assembled += m[2] || '';
            }
            // unescape common JS escapes in the found string (so "\n" -> newline, "\x41" -> 'A' etc.)
            // We'll do a simple safe unescape using JSON trick for quotes/backslash/newline/unicode/hex.
            try {
                // wrap in double quotes and replace unescaped double-quotes inside
                const safe = assembled.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                assembled = JSON.parse('"' + safe + '"');
            } catch (e) {
                // fallback: leave as-is if JSON parse fails
            }
        }

        // 3) Find for loop upper bound number: typical pattern `for (var i = 0; i < 27; i++)`
        const forRe = /for\s*\(\s*(?:var\s+)?\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\d+)\s*;\s*\w+\+\+\s*\)/;
        const forMatch = src.match(forRe);
        const count = forMatch ? parseInt(forMatch[1], 10) : null;

        return {
            str: assembled,
            count: Number.isFinite(count) ? count : null
        };
    }

    clientInit() {
        var cv = Math.floor(Math.random() * 9);
        var cpw = [54, 206, 204, 169, 97, 178, 74, 136, 124, 117, 14, 210, 106, 236, 8, 208, 136, 213, 140, 111];
        var client_version = 291;
        var s = "";
        var ca = new Array();

        var ba = new Uint8Array(8 + 20 + s.length + ca.length);
        ba[0] = 115;
        ba[1] = 30;
        ba[2] = client_version >> 8 & 255;
        ba[3] = client_version & 255;
        for (var i = 0; i < 20; i++)
            ba[4 + i] = cpw[i];
        ba[24] = cv;
        ba[25] = s.length;
        var m = 26;
        for (var i = 0; i < s.length; i++) {
            ba[m] = s.charCodeAt(i);
            m++
        }
        ba[m] = 0;
        m++;
        ba[m] = 255;
        m++;
        for (var i = 0; i < ca.length; i++) {
            ba[m] = ca[i];
            m++
        }

        this.send(ba);
    }

    onClose(event) {
        const code = event && typeof event.code === "number" ? event.code : 0;
        const reason = event && event.reason ? String(event.reason) : "";
        this.ws = null;
        if (!this._completed) {
            const message = reason
                ? `Socket closed before stats (code ${code}, reason: ${reason})`
                : `Socket closed before stats (code ${code})`;
            this._fail(new Error(message));
        }
    }

    onError(event) {
        const message = event && event.message ? event.message : "Unknown socket error";
        //console.error(`[Error] ${message}`);
        const error = event instanceof Error ? event : new Error(message);
        this._fail(error);
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            console.warn("Socket not open, message skipped");
        }
    }

    close() {
        if (!this.ws) return;
        if (this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED) return;
        try {
            this.ws.close();
        } catch (_error) {
            // ignore close errors
        }
    }
};
