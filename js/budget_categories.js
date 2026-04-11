// ============================================================
//  budget_categories.js  — 예산 세목 & 세부 프로그램 공통 정의
// ============================================================

// ── 예산 세목 10개 ────────────────────────────────────────────
const BUDGET_ITEMS = [
    { value: '공공요금및제세',     label: '공공요금및제세' },
    { value: '관리용역비',         label: '관리용역비' },
    { value: '민간경상보조',       label: '민간경상보조' },
    { value: '사업추진업무추진비', label: '사업추진업무추진비' },
    { value: '운영수당',           label: '운영수당' },
    { value: '일반수용비',         label: '일반수용비' },
    { value: '일반용역비',         label: '일반용역비' },
    { value: '일용임금',           label: '일용임금' },
    { value: '일용직부담금',       label: '일용직부담금' },
    { value: '장학금',             label: '장학금' },
    { value: '포상금',             label: '포상금' },
    { value: '국내여비',           label: '국내여비' },
    { value: '인건비및부담금',     label: '인건비및부담금' },
];

// <select> 옵션 HTML 생성 헬퍼
function budgetItemOptions(selectedVal = '') {
    return BUDGET_ITEMS.map(item =>
        `<option value="${item.value}" ${item.value === selectedVal ? 'selected' : ''}>${item.label}</option>`
    ).join('');
}

// 세목별 배지 색상
const BUDGET_ITEM_COLORS = {
    '공공요금및제세':     { color: '#2563eb', bg: '#eff6ff' },
    '관리용역비':         { color: '#7c3aed', bg: '#f5f3ff' },
    '민간경상보조':       { color: '#059669', bg: '#ecfdf5' },
    '사업추진업무추진비': { color: '#d97706', bg: '#fffbeb' },
    '운영수당':           { color: '#db2777', bg: '#fdf2f8' },
    '일반수용비':         { color: '#0891b2', bg: '#ecfeff' },
    '일반용역비':         { color: '#9333ea', bg: '#faf5ff' },
    '일용임금':           { color: '#65a30d', bg: '#f7fee7' },
    '일용직부담금':       { color: '#ea580c', bg: '#fff7ed' },
    '장학금':             { color: '#0f766e', bg: '#f0fdfa' },
    '포상금':             { color: '#be185d', bg: '#fdf2f8' },
    '국내여비':           { color: '#2563eb', bg: '#eff6ff' },
    '인건비및부담금':     { color: '#dc2626', bg: '#fef2f2' },
};

function budgetItemBadge(itemName) {
    const s = BUDGET_ITEM_COLORS[itemName] || { color: '#6b7280', bg: '#f3f4f6' };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;
        font-size:11px;font-weight:600;color:${s.color};background:${s.bg}">${itemName || '-'}</span>`;
}


// ── 프로그램별 예산 계산 헬퍼 ─────────────────────────────────

/**
 * 예산 rows 배열에서 프로그램(title)별로
 *   - 예산액: 가장 큰 budgeted_amount 1개 (= 처음 설정한 총 예산)
 *   - 집행액: 모든 행의 executed_amount 합산
 * 형태의 Map을 반환합니다.
 *
 * @param {Array} budgetRows - allBudget 또는 필터링된 budget 배열
 * @returns {Map<string, {budget: number, exec: number}>}
 */
function calcProgBudgetMap(budgetRows) {
    const map = new Map(); // key: title(프로그램명)
    budgetRows.forEach(r => {
        const key = r.title || '(미지정)';
        if (!map.has(key)) map.set(key, { budget: 0, exec: 0 });
        const entry = map.get(key);
        // 예산액은 가장 큰 값 1개만 (= 최초 설정값)
        if ((+r.budgeted_amount || 0) > entry.budget) {
            entry.budget = +r.budgeted_amount || 0;
        }
        // 집행액은 누산
        entry.exec += (+r.executed_amount || 0);
    });
    return map;
}

/**
 * 예산 rows에서 세목(budget_item)별로
 *   - 예산액: 해당 세목에 속한 프로그램들의 예산액 합 (프로그램당 1회)
 *   - 집행액: 모든 행 합산
 * 형태의 객체를 반환합니다.
 *
 * @param {Array} budgetRows
 * @returns {Object<string, {b: number, e: number}>}
 */
function calcItemBudgetMap(budgetRows) {
    // 1) 프로그램별로 집계 (예산: max, 집행: sum)
    const progMap = new Map();
    budgetRows.forEach(r => {
        const pKey = (r.title || '(미지정)') + '||' + (r.budget_item || '기타');
        if (!progMap.has(pKey)) progMap.set(pKey, { item: r.budget_item || '기타', budget: 0, exec: 0 });
        const e = progMap.get(pKey);
        if ((+r.budgeted_amount || 0) > e.budget) e.budget = +r.budgeted_amount || 0;
        e.exec += (+r.executed_amount || 0);
    });
    // 2) 세목별 합산
    const result = {};
    BUDGET_ITEMS.forEach(item => { result[item.value] = { b: 0, e: 0 }; });
    progMap.forEach(({ item, budget, exec }) => {
        if (!result[item]) result[item] = { b: 0, e: 0 };
        result[item].b += budget;
        result[item].e += exec;
    });
    return result;
}

/** 예산 rows 전체에서 총 예산액(프로그램 중복 제거) 계산 */
function calcTotalBudget(budgetRows) {
    let total = 0;
    calcProgBudgetMap(budgetRows).forEach(v => { total += v.budget; });
    return total;
}

/** 예산 rows 전체에서 총 집행액 계산 */
function calcTotalExec(budgetRows) {
    return budgetRows.reduce((s, r) => s + (+r.executed_amount || 0), 0);
}

/**
 * 특정 프로그램(title)의 총 예산액을 반환
 * (같은 title을 가진 rows 중 가장 큰 budgeted_amount)
 */
function getProgTotalBudget(budgetRows, title) {
    let max = 0;
    budgetRows.forEach(r => {
        if (r.title === title && (+r.budgeted_amount || 0) > max) max = +r.budgeted_amount;
    });
    return max;
}

/**
 * 특정 프로그램(title)의 누계 집행액 반환 (excludeId 제외)
 */
function getProgSumExec(budgetRows, title, excludeId = '') {
    return budgetRows
        .filter(r => r.title === title && r.id !== excludeId && !r.deleted)
        .reduce((s, r) => s + (+r.executed_amount || 0), 0);
}

const DEPT_PROGRAMS = {
    system: [
        'CIEAT 유지보수',
        'CIEAT 마일리지 이벤트',
        'CIEAT 마일리지 우수 학과',
        'CIEAT 마일리지 우수 학생',
        '비교과 우수사례 경진대회',
        '비교과 수기공모전',
        '비교과과정운영위원회',
    ],
    rc: [
        'RC-Bridge',
        'RC-Makers',
        'RC-10minutes',
        'RC-특강',
        'RC-인사이트',
        'RC-초급 영어회화',
        'RC-봉사활동',
        'RC-나만의 학습법',
        'RC-운영관리',
    ],
    communication: [
        'CBNU 에세이 대회',
        '글쓰기 상담',
        '교과 연계',
        '독서골든벨',
        '독서나눔',
        '독서모임',
        '독서인증제',
        '스피치멘토링',
        '토론광장',
        '의사소통 관리',
        '의사소통 성과 확산',
    ],
};

/**
 * 부서 코드로 세부 프로그램 <select> 옵션 HTML 반환
 * @param {string} dept      - 'system' | 'rc' | 'communication'
 * @param {string} selectedVal - 현재 선택값 (수정 시 사용)
 */
function deptProgramOptions(dept, selectedVal = '') {
    const list = DEPT_PROGRAMS[dept] || [];
    if (list.length === 0) return '<option value="">프로그램 없음</option>';
    return list.map(name =>
        `<option value="${name}" ${name === selectedVal ? 'selected' : ''}>${name}</option>`
    ).join('');
}

/**
 * bTitle select 요소를 지정 부서의 프로그램 목록으로 채움 (예산 모달용)
 * '기타(직접 입력)' 옵션 포함
 * @param {string} dept
 * @param {string} selectedVal
 */
function populateProgramSelect(dept, selectedVal = '') {
    const sel = document.getElementById('bTitle');
    if (!sel) return;
    const list = DEPT_PROGRAMS[dept] || [];
    // 목록에 없는 값이면 '기타'로 간주
    const isOther = selectedVal && !list.includes(selectedVal);
    sel.innerHTML = '<option value="">세부 프로그램 선택 *</option>' +
        list.map(name =>
            `<option value="${name}" ${name === selectedVal ? 'selected' : ''}>${name}</option>`
        ).join('') +
        `<option value="__other__" ${isOther ? 'selected' : ''}>기타(직접 입력)</option>`;
    // 기타 직접입력 박스 처리
    _syncOtherInput('bTitle', 'bTitleOther', isOther ? selectedVal : '');
}

/**
 * tTitle select 요소를 지정 부서의 프로그램 목록으로 채움 (과제 모달용)
 * '기타(직접 입력)' 옵션 포함
 * @param {string} dept
 * @param {string} selectedVal
 */
function populateTaskProgramSelect(dept, selectedVal = '') {
    const sel = document.getElementById('tTitle');
    if (!sel) return;
    const list = DEPT_PROGRAMS[dept] || [];
    const isOther = selectedVal && !list.includes(selectedVal);
    sel.innerHTML = '<option value="">과제(프로그램) 선택 *</option>' +
        list.map(name =>
            `<option value="${name}" ${name === selectedVal ? 'selected' : ''}>${name}</option>`
        ).join('') +
        `<option value="__other__" ${isOther ? 'selected' : ''}>기타(직접 입력)</option>`;
    _syncOtherInput('tTitle', 'tTitleOther', isOther ? selectedVal : '');
}

/**
 * select 변경 시 '기타' 직접입력 input 표시/숨김 및 값 초기화
 * HTML에서 onchange="onProgramSelectChange('bTitle','bTitleOther')" 로 호출
 */
function onProgramSelectChange(selId, inputId) {
    const sel = document.getElementById(selId);
    const inp = document.getElementById(inputId);
    if (!sel || !inp) return;
    if (sel.value === '__other__') {
        inp.style.display = 'block';
        inp.focus();
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
}

/**
 * select/input 쌍의 실제 최종값을 반환
 * '__other__' 선택 시 input 값을 반환
 */
function getProgramValue(selId, inputId) {
    const sel = document.getElementById(selId);
    if (!sel) return '';
    if (sel.value === '__other__') {
        const inp = document.getElementById(inputId);
        return inp ? inp.value.trim() : '';
    }
    return sel.value;
}

/** 내부 헬퍼: 기타 input 동기화 */
function _syncOtherInput(selId, inputId, otherVal) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (otherVal) {
        inp.style.display = 'block';
        inp.value = otherVal;
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
}
