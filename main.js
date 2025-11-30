// --- IMPORT LIBRARY DARI CDN (Versi Modular) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBkfNxlq8KgK1OXQjLvWqF_JsTNZIxV9Bo",
    authDomain: "mes-project-d9083.firebaseapp.com",
    databaseURL: "https://mes-project-d9083-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mes-project-d9083",
    storageBucket: "mes-project-d9083.firebasestorage.app",
    messagingSenderId: "69213712352",
    appId: "1:69213712352:web:40e9cb8c9c9cb3e0814585"
};

// --- 2. INISIALISASI APLIKASI ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- PERUBAHAN PATH DATABASE (SESUAI GAMBAR BARU) ---
const relayPath = ref(db, 'pabrik/kontrol/perintah'); // Path ke perintah ON/OFF
const monitoringPath = ref(db, 'pabrik/monitoring');  // Path ke sensor

// Variabel Global
let isMotorOn = false; // Kita tetap pakai boolean di internal JS biar mudah
let chartInstance = null;

// --- 3. FUNGSI UPDATE UI (TAMPILAN) ---

// Fungsi Update Tombol Relay
function updateRelayUI(statusString) {
    const btn = document.getElementById("btnRelay");
    const statusText = document.querySelector('.relay-status');
    
    // Konversi String "ON"/"OFF" dari Firebase ke Boolean true/false
    if (statusString === "ON") {
        isMotorOn = true;
    } else {
        isMotorOn = false;
    }

    if (isMotorOn) {
        // KONDISI: MESIN MENYALA (TOMBOL BERUBAH JADI 'MATIKAN')
        btn.className = "btn-control btn-off";
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
            MATIKAN MESIN
        `;
        statusText.innerHTML = '<span class="indicator indicator-green"></span> ONLINE (Berjalan)';
    
    } else {
        // KONDISI: MESIN MATI (TOMBOL BERUBAH JADI 'NYALAKAN')
        btn.className = "btn-control btn-on";
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
            NYALAKAN MESIN
        `;
        statusText.innerHTML = '<span class="indicator indicator-red"></span> OFFLINE (Berhenti)';
    }
}

// Fungsi Update Status Bahaya/Aman
function updateSafetyUI(statusMesin, ampere, suhu) {
    const statusBox = document.getElementById("statusBox");
    const valAmpere = document.getElementById("valAmpere");
    const valSuhu = document.getElementById("valSuhu");

    // Update Angka
    valAmpere.textContent = ampere;
    valSuhu.textContent = suhu;

    // Cek Status (Menggunakan key 'status_mesin' dari Firebase)
    // Asumsi: Jika status_mesin bukan "STANDBY" atau "AMAN", kita anggap bahaya/overload
    // Atau jika string mengandung kata "OVERLOAD" atau "BAHAYA"
    
    if (statusMesin === "OVERLOAD" || statusMesin === "BAHAYA") {
        statusBox.className = "status-box status-bahaya";
        statusBox.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> BAHAYA: OVERLOAD`;
    } else {
        // Default Aman (Termasuk status "STANDBY")
        statusBox.className = "status-box status-aman";
        // Kita tampilkan teks statusnya langsung dari database (misal: "STANDBY" atau "AMAN")
        statusBox.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> ${statusMesin || "SISTEM AMAN"}`;
    }
}

// --- SETUP CHART ---
function initChart() {
    const ctx = document.getElementById('myChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Arus (A)',
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    data: [],
                    tension: 0.4, fill: true, borderWidth: 2
                },
                {
                    label: 'Suhu (°C)',
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    data: [],
                    tension: 0.4, fill: true, borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#cbd5e1' } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            },
            animation: false
        }
    });
}

function updateChart(ampere, suhu) {
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit', second:'2-digit'});
    if (chartInstance.data.labels.length > 15) {
        chartInstance.data.labels.shift();
        chartInstance.data.datasets[0].data.shift();
        chartInstance.data.datasets[1].data.shift();
    }
    chartInstance.data.labels.push(now);
    chartInstance.data.datasets[0].data.push(ampere);
    chartInstance.data.datasets[1].data.push(suhu);
    chartInstance.update();
}

// --- LISTENERS (LOGIKA UTAMA) ---

// 1. Baca Relay (Mengambil String "ON" atau "OFF")
onValue(relayPath, (snap) => {
    const statusString = snap.val(); // Isinya "ON" atau "OFF"
    updateRelayUI(statusString);
});

// 2. Baca Monitoring (Update Data Sensor)
onValue(monitoringPath, (snap) => {
    const data = snap.val();
    if (data) {
        // Perhatikan disini: data.status diganti jadi data.status_mesin
        updateSafetyUI(data.status_mesin, data.ampere, data.suhu);
        updateChart(data.ampere, data.suhu);
    }
});

// 3. Tombol Klik (Kirim String "ON" atau "OFF")
document.getElementById("btnRelay").addEventListener("click", () => {
    // Jika sekarang nyala, kirim "OFF". Jika mati, kirim "ON".
    const newValue = isMotorOn ? "OFF" : "ON";
    set(relayPath, newValue);
});

initChart();