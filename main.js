// --- IMPORT LIBRARY DARI CDN (Versi Modular) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- 1. KONFIGURASI FIREBASE (GANTI INI DENGAN PUNYAMU) ---
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

// Referensi Database Path
const relayPath = ref(db, 'control/relay');
const monitoringPath = ref(db, 'monitoring');

// Variabel Global
let isMotorOn = false;
let chartInstance = null;

// --- 3. FUNGSI UPDATE UI (TAMPILAN) ---

// Fungsi Update Tombol Relay
function updateRelayUI(status) {
    const btn = document.getElementById("btnRelay");
    const statusText = document.querySelector('.relay-status');
    
    isMotorOn = status;

    if (status) {
        // KONDISI: MESIN MENYALA (TOMBOL BERUBAH JADI 'MATIKAN')
        btn.className = "btn-control btn-off";
        
        // GANTI DI SINI: Ikon Power (Garis dalam Lingkaran Terputus)
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
        
        // Ikon Power yang sama agar konsisten
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
// GANTI BAGIAN updateSafetyUI DENGAN INI:
function updateSafetyUI(status, ampere, suhu) {
    const statusBox = document.getElementById("statusBox");
    const valAmpere = document.getElementById("valAmpere");
    const valSuhu = document.getElementById("valSuhu");

    // Update Angka
    valAmpere.textContent = ampere;
    valSuhu.textContent = suhu;

    // Cek Status
    if (status === "OVERLOAD") {
        statusBox.className = "status-box status-bahaya";
        statusBox.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> BAHAYA: OVERLOAD`;
    } else {
        statusBox.className = "status-box status-aman";
        statusBox.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> SISTEM AMAN`;
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
                    borderColor: '#3b82f6', // Biru
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    data: [],
                    tension: 0.4, fill: true, borderWidth: 2
                },
                {
                    label: 'Suhu (°C)',
                    borderColor: '#10b981', // Hijau
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

// --- LISTENERS ---
onValue(relayPath, (snap) => updateRelayUI(snap.val()));
onValue(monitoringPath, (snap) => {
    const data = snap.val();
    if (data) {
        updateSafetyUI(data.status, data.ampere, data.suhu);
        updateChart(data.ampere, data.suhu);
    }
});
document.getElementById("btnRelay").addEventListener("click", () => set(relayPath, !isMotorOn));

initChart();