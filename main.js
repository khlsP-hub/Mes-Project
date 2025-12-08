// --- 1. IMPORT LIBRARY FIREBASE ---
// PERHATIKAN: Kita menambahkan 'remove' di daftar import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, update, remove, onValue, push, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 2. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBkfNxlq8KgK1OXQjLvWqF_JsTNZIxV9Bo", 
    authDomain: "mes-project-d9083.firebaseapp.com",
    databaseURL: "https://mes-project-d9083-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mes-project-d9083",
    storageBucket: "mes-project-d9083.firebasestorage.app",
    messagingSenderId: "69213712352",
    appId: "1:69213712352:web:40e9cb8c9c9cb3e0814585"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 3. PATH DATABASE ---
const relayPath = ref(db, 'pabrik/kontrol/perintah'); 
const monitoringPath = ref(db, 'pabrik/monitoring'); 
const logsPath = ref(db, 'pabrik/logs');

// --- 4. VARIABEL GLOBAL ---
let isMotorOn = false;
let chartInstance = null;
let currentMaxAmpere = 5.0; 
let currentMaxSuhu = 60;    
let audioAlarm = document.getElementById("alarmAudio");
let isAlarmPlaying = false;
let lastDangerMessage = ""; 

// --- 5. SETUP GRAFIK ---
function initChart() {
    const ctx = document.getElementById('myChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Arus (A)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], tension: 0.4, fill: true },
                { label: 'Suhu (°C)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', data: [], tension: 0.4, fill: true }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: { legend: { labels: { color: '#cbd5e1' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function updateChart(ampere, suhu) {
    const now = new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit'});
    if (chartInstance.data.labels.length > 15) {
        chartInstance.data.labels.shift();
        chartInstance.data.datasets.forEach(d => d.data.shift());
    }
    chartInstance.data.labels.push(now);
    chartInstance.data.datasets[0].data.push(ampere);
    chartInstance.data.datasets[1].data.push(suhu);
    chartInstance.update();
}

// --- 6. LOGGING ---
function writeLog(type, category, message) {
    const now = new Date().toLocaleString('id-ID');
    push(logsPath, { timestamp: now, type: type, category: category, message: message })
        .catch(error => console.error("Gagal tulis log:", error));
}

// --- 7. LOGIKA UI ---

function updateRelayUI(statusString) {
    const btn = document.getElementById("btnRelay");
    const statusText = document.querySelector('.relay-status');
    const valStatusMesin = document.getElementById("valStatusMesin");
    
    isMotorOn = (statusString === "ON");

    if (isMotorOn) {
        btn.className = "btn-control btn-off";
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> MATIKAN MESIN`;
        statusText.innerHTML = '<span class="indicator indicator-green"></span> ONLINE';
        
        if(valStatusMesin) {
            valStatusMesin.textContent = "RUNNING";
            valStatusMesin.style.color = "#34d399"; 
        }

    } else {
        btn.className = "btn-control btn-on";
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> NYALAKAN MESIN`;
        statusText.innerHTML = '<span class="indicator indicator-red"></span> OFFLINE';

        if(valStatusMesin) {
            valStatusMesin.textContent = "STANDBY";
            valStatusMesin.style.color = "#94a3b8";
        }
    }
}

function updateSafetyUI(indikatorKeamanan, ampere, suhu) {
    const statusBox = document.getElementById("statusBox");
    document.getElementById("valAmpere").textContent = ampere;
    document.getElementById("valSuhu").textContent = suhu;

    let isDanger = false;
    let dangerMessages = [];

    if (ampere > currentMaxAmpere) {
        isDanger = true;
        dangerMessages.push(`ARUS > ${currentMaxAmpere}A`);
    } 
    if (suhu > currentMaxSuhu) {
        isDanger = true;
        dangerMessages.push(`SUHU > ${currentMaxSuhu}°C`);
    } 
    
    if (indikatorKeamanan === "BAHAYA" || indikatorKeamanan === "OVERLOAD") {
        isDanger = true;
        if (!dangerMessages.includes("BAHAYA TERDETEKSI")) dangerMessages.push("STATUS BAHAYA");
    }

    if (isDanger) {
        const currentMsgString = dangerMessages.join(" & ");

        statusBox.className = "status-box status-bahaya";
        statusBox.innerHTML = `⚠️ ${currentMsgString}`;
        
        if (audioAlarm && !isAlarmPlaying) {
            audioAlarm.play().catch(e => console.log("Audio dicegah browser"));
            isAlarmPlaying = true;
        }

        if (currentMsgString !== lastDangerMessage) {
            writeLog("DANGER", "SAFETY", `Terdeteksi: ${currentMsgString}`);
            lastDangerMessage = currentMsgString; 
        }

    } else {
        statusBox.className = "status-box status-aman";
        statusBox.innerHTML = `✅ ${indikatorKeamanan || "AMAN"}`;
        
        if (audioAlarm && isAlarmPlaying) {
            audioAlarm.pause();
            audioAlarm.currentTime = 0;
            isAlarmPlaying = false;
        }
        
        lastDangerMessage = "";
    }
}

// --- 8. DATABASE LISTENERS ---

onValue(relayPath, (snap) => updateRelayUI(snap.val()));

onValue(monitoringPath, (snap) => {
    const data = snap.val();
    if (data) {
        const amp = data.ampere || 0;
        const temp = data.suhu || 0;
        const indikator = data.indikator_keamanan || "AMAN"; 
        
        if (data.maxAmpere !== undefined) currentMaxAmpere = parseFloat(data.maxAmpere);
        if (data.maxSuhu !== undefined) currentMaxSuhu = parseFloat(data.maxSuhu);

        const inputAmp = document.getElementById("inputMaxAmpere");
        const inputSuhu = document.getElementById("inputMaxSuhu");
        if (inputAmp) inputAmp.placeholder = currentMaxAmpere;
        if (inputSuhu) inputSuhu.placeholder = currentMaxSuhu;

        updateSafetyUI(indikator, amp, temp);
        updateChart(amp, temp);
    }
});

// --- 9. LOG HISTORY ---
const logsQuery = query(logsPath, limitToLast(30));
onValue(logsQuery, (snapshot) => {
    const tableSafety = document.getElementById("logTableSafety");
    const tableConfig = document.getElementById("logTableConfig");
    const tableStatus = document.getElementById("logTableStatus");

    if(tableSafety) tableSafety.innerHTML = ""; 
    if(tableConfig) tableConfig.innerHTML = ""; 
    if(tableStatus) tableStatus.innerHTML = "";
    
    if (!snapshot.exists()) {
        const emptyRow = "<tr><td colspan='2' style='text-align:center; padding: 10px; color: #64748b;'>Belum ada data.</td></tr>";
        if(tableSafety) tableSafety.innerHTML = emptyRow;
        if(tableConfig) tableConfig.innerHTML = emptyRow;
        if(tableStatus) tableStatus.innerHTML = emptyRow;
        return;
    }

    const logs = [];
    snapshot.forEach((child) => { if(child.val()) logs.push(child.val()); });

    logs.reverse().forEach(log => {
        if (!log.timestamp) return;

        let category = log.category;
        if (!category) {
            if (log.type === "DANGER" || (log.message && log.message.includes("Terdeteksi"))) category = "SAFETY";
            else if (log.message && log.message.includes("Update Batas")) category = "CONFIG";
            else category = "STATUS";
        }

        const row = `<tr><td><small style='color:#94a3b8'>${log.timestamp}</small></td><td>${log.message}</td></tr>`;

        if (category === "SAFETY" && tableSafety) tableSafety.innerHTML += row;
        else if (category === "CONFIG" && tableConfig) tableConfig.innerHTML += row;
        else if (tableStatus) tableStatus.innerHTML += row;
    });
});

// --- 10. BUTTON ACTIONS ---
document.getElementById("btnRelay").addEventListener("click", () => {
    const newValue = isMotorOn ? "OFF" : "ON";
    set(relayPath, newValue).then(() => {
        const logType = newValue === "ON" ? "INFO" : "WARNING";
        writeLog(logType, "STATUS", `Mesin diubah ke status ${newValue}`);
    }).catch(err => alert("Gagal koneksi: " + err.message));
});

document.getElementById("btnSaveConfig").addEventListener("click", () => {
    const inputAmp = document.getElementById("inputMaxAmpere");
    const inputSuhu = document.getElementById("inputMaxSuhu");
    const newAmpere = parseFloat(inputAmp.value);
    const newSuhu = parseFloat(inputSuhu.value);

    if (newAmpere && newSuhu) {
        update(monitoringPath, { maxAmpere: newAmpere, maxSuhu: newSuhu })
            .then(() => {
                alert("Pengaturan tersimpan!");
                writeLog("INFO", "CONFIG", `Update Batas: Max ${newAmpere}A, ${newSuhu}°C`);
                inputAmp.value = ""; inputSuhu.value = "";
            }).catch(err => alert("Gagal: " + err.message));
    } else {
        alert("Masukkan angka valid!");
    }
});

// --- TOMBOL HAPUS LOG (BARU) ---
document.getElementById("btnClearLogs").addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin menghapus SEMUA riwayat log? Data tidak bisa dikembalikan.")) {
        remove(logsPath)
            .then(() => alert("Semua log berhasil dihapus."))
            .catch((error) => alert("Gagal menghapus log: " + error.message));
    }
});

// Navigasi Tab
const btnDash = document.getElementById("navDash");
const btnLogs = document.getElementById("navLogs");
const viewDash = document.getElementById("viewDashboard");
const viewLogs = document.getElementById("viewLogs");

function switchTab(target) {
    if (target === 'dashboard') {
        viewDash.style.display = "block";
        viewLogs.style.display = "none";
        btnDash.classList.add("active");
        btnLogs.classList.remove("active");
    } else {
        viewDash.style.display = "none";
        viewLogs.style.display = "block";
        btnDash.classList.remove("active");
        btnLogs.classList.add("active");
    }
}
btnDash.addEventListener("click", () => switchTab('dashboard'));
btnLogs.addEventListener("click", () => switchTab('logs'));

initChart();