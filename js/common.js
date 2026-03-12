// ============================================================
//  common.js  — 공통 유틸리티 (젠스파크 API 의존성 완전 제거)
// ============================================================

// ── URL 토큰 기반 인증 ───────────────────────────────────────
const ACCESS_TOKENS = {
    'MGR-2026-K9mXpQ7vRt':  { id:'manager01', name:'팀장',    role:'manager',    department:'all',           position:'팀장',  page:'dashboard_manager.html' },
    'SYS-2026-A3nLwE8cZu':  { id:'staff01',   name:'최진아', role:'staff',      department:'system',        position:'직원',  page:'dashboard_system.html' },
    'RC-2026-B7qYmF2dVs':   { id:'staff02',   name:'이명옥',  role:'staff',      department:'rc',            position:'직원',  page:'dashboard_rc.html' },
    'COM1-2026-C4rHkG5eWn': { id:'res01',     name:'김자영', role:'researcher', department:'communication', position:'연구원', page:'dashboard_comm.html' },
    'COM2-2026-D8sTjI9fXo': { id:'res02',     name:'이진우', role:'researcher', department:'communication', position:'연구원', page:'dashboard_comm.html' },
    'COM3-2026-E2uUlJ6gYp': { id:'res03',     name:'김진국', role:'researcher', department:'communication', position:'연구원', page:'dashboard_comm.html' },
    'COM4-2026-F6vVmK3hZq': { id:'res04',     name:'손대익', role:'researcher', department:'communication', position:'연구원', page:'dashboard_comm.html' },
};

function authByToken(allowedRoles = []) {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('key');

    if (token) {
        const userInfo = ACCESS_TOKENS[token];
        if (!userInfo) { showAccessDenied('유효하지 않은 접근 링크입니다.'); return null; }
        if (allowedRoles.length > 0 && !allowedRoles.includes(userInfo.role)) {
            showAccessDenied('접근 권한이 없습니다.'); return null;
        }
        sessionStorage.setItem('currentUser', JSON.stringify({ ...userInfo, token }));
        return { ...userInfo, token };
    }

    const stored = sessionStorage.getItem('currentUser');
    if (stored) {
        const userInfo = JSON.parse(stored);
        if (allowedRoles.length > 0 && !allowedRoles.includes(userInfo.role)) {
            showAccessDenied('접근 권한이 없습니다.'); return null;
        }
        return userInfo;
    }

    showAccessDenied('접근 링크가 필요합니다.<br>팀장에게 개인 접근 링크를 요청하세요.');
    return null;
}

function requireAuth(allowedRoles = []) { return authByToken(allowedRoles); }

function logout() {
    sessionStorage.removeItem('currentUser');
    location.href = 'index.html';
}

function showAccessDenied(msg = '접근 권한이 없습니다.') {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
            background:linear-gradient(135deg,#1a3a5c,#0d6efd);font-family:'Noto Sans KR',sans-serif;">
            <div style="background:white;border-radius:20px;padding:48px 40px;text-align:center;
                max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="font-size:52px;margin-bottom:16px">🔒</div>
                <h2 style="font-size:20px;font-weight:700;color:#1a3a5c;margin-bottom:10px">접근이 제한됩니다</h2>
                <p style="font-size:14px;color:#6b7280;line-height:1.7;margin-bottom:24px">${msg}</p>
                <a href="index.html" style="display:inline-block;padding:10px 24px;background:#0d6efd;
                    color:white;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
                    홈으로 돌아가기
                </a>
            </div>
        </div>`;
}

// ── 날짜 유틸 ────────────────────────────────────────────────
function getToday()        { return new Date().toISOString().split('T')[0]; }
function getYear(date)     { return new Date(date).getFullYear(); }
function getMonth(date)    { return new Date(date).getMonth() + 1; }
function getQuarter(month) { return Math.ceil(month / 3); }
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function formatMoney(num) {
    if (!num && num !== 0) return '-';
    return Number(num).toLocaleString('ko-KR') + '원';
}
function pct(executed, budgeted) {
    if (!budgeted || budgeted === 0) return 0;
    return Math.round((executed / budgeted) * 100);
}

// ── 배지 맵 ─────────────────────────────────────────────────
const STATUS_MAP = {
    todo:        { label:'예정',     color:'#6b7280', bg:'#f3f4f6' },
    in_progress: { label:'진행중',   color:'#2563eb', bg:'#eff6ff' },
    done:        { label:'완료',     color:'#059669', bg:'#ecfdf5' },
    delayed:     { label:'지연',     color:'#dc2626', bg:'#fef2f2' },
    preparing:   { label:'준비중',   color:'#d97706', bg:'#fffbeb' },
    submitted:   { label:'제출완료', color:'#7c3aed', bg:'#f5f3ff' },
    completed:   { label:'완료',     color:'#059669', bg:'#ecfdf5' },
};
const PRIORITY_MAP = {
    high:   { label:'높음', color:'#dc2626', bg:'#fef2f2' },
    medium: { label:'중간', color:'#d97706', bg:'#fffbeb' },
    low:    { label:'낮음', color:'#059669', bg:'#ecfdf5' },
};
const SEVERITY_MAP = {
    high:   { label:'긴급', color:'#dc2626', bg:'#fef2f2' },
    medium: { label:'일반', color:'#d97706', bg:'#fffbeb' },
    low:    { label:'낮음', color:'#6b7280', bg:'#f3f4f6' },
};
const DEPT_MAP = {
    system:        { label:'비교과통합관리시스템', color:'#7c3aed', bg:'#f5f3ff' },
    rc:            { label:'RC 프로그램',         color:'#059669', bg:'#ecfdf5' },
    communication: { label:'의사소통 교육',       color:'#d97706', bg:'#fffbeb' },
    general:       { label:'전체',               color:'#2563eb', bg:'#eff6ff' },
    all:           { label:'전체',               color:'#2563eb', bg:'#eff6ff' },
};

function badge(map, key) {
    const s = map[key] || { label: key || '-', color:'#6b7280', bg:'#f3f4f6' };
    return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;
        font-size:11px;font-weight:600;color:${s.color};background:${s.bg}">${s.label}</span>`;
}

// ── 현재 날짜 상수 ───────────────────────────────────────────
const NOW         = new Date();
const CUR_YEAR    = NOW.getFullYear();
const CUR_MONTH   = NOW.getMonth() + 1;
const CUR_QUARTER = getQuarter(CUR_MONTH);

// ── 저장소 상태 배지 삽입 ────────────────────────────────────
// 대시보드 페이지의 사이드바 하단에 현재 저장소 상태를 표시합니다
function injectStorageBadge(containerId = 'storageBadge') {
    const el = document.getElementById(containerId);
    if (!el) return;

    // DB 모듈이 로드됐는지 확인
    const isSupabase = (typeof DB !== 'undefined') && DB.isSupabase && DB.isSupabase();
    if (isSupabase) {
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;margin:8px 0">
                <div style="width:8px;height:8px;background:#10b981;border-radius:50%;
                    box-shadow:0 0 0 3px rgba(16,185,129,0.2);flex-shrink:0"></div>
                <div>
                    <div style="font-size:11px;font-weight:700;color:#059669">☁️ Supabase 연결됨</div>
                    <div style="font-size:10px;color:#6b7280">클라우드 저장 · 영구 운영</div>
                </div>
            </div>`;
    } else {
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:8px 0">
                <div style="width:8px;height:8px;background:#f59e0b;border-radius:50%;
                    box-shadow:0 0 0 3px rgba(245,158,11,0.2);flex-shrink:0"></div>
                <div>
                    <div style="font-size:11px;font-weight:700;color:#d97706">💾 브라우저 임시 저장</div>
                    <div style="font-size:10px;color:#6b7280">
                        <a href="setup.html" target="_blank"
                           style="color:#d97706;text-decoration:none;font-weight:600">
                           영구 저장 설정하기 →
                        </a>
                    </div>
                </div>
            </div>`;
    }
}
