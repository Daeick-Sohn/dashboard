// ============================================================
//  excel_export.js  — 엑셀(CSV/HTML Table) 다운로드 유틸
//  SheetJS(XLSX) CDN 없이 순수 JS로 구현
//  → .xls(HTML Table 방식)로 저장 — Excel에서 바로 열림
// ============================================================

const ExcelExport = (() => {

    // ── 내부 유틸 ────────────────────────────────────────────
    function esc(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function won(n) {
        if (!n && n !== 0) return '-';
        return Number(n).toLocaleString('ko-KR');
    }
    function pctFn(e, b) {
        if (!b || b === 0) return '0%';
        return Math.round((e / b) * 100) + '%';
    }
    function periodLabel(view, period, year) {
        if (view === 'monthly')   return `${year}년 ${period}월`;
        if (view === 'quarterly') return `${year}년 ${period}분기`;
        return `${year}년 전체`;
    }
    function deptLabel(dept) {
        const m = { system:'비교과통합관리시스템', rc:'RC 프로그램', communication:'의사소통 교육' };
        return m[dept] || dept;
    }

    // ── HTML Table → xls 다운로드 ────────────────────────────
    function downloadXLS(htmlContent, filename) {
        const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename + '.xls';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── 공통 헤더 스타일 ─────────────────────────────────────
    const baseStyle = `
        <style>
            body { font-family: '맑은 고딕', sans-serif; font-size: 10pt; }
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #1a3a5c; color: white; padding: 6px 10px;
                 text-align: center; font-size: 10pt; border: 1px solid #ccc; }
            td { padding: 5px 8px; border: 1px solid #ddd; font-size: 10pt; vertical-align: middle; }
            tr:nth-child(even) td { background-color: #f9f9f9; }
            .title-row td { background-color: #1a3a5c; color: white; font-size: 13pt;
                            font-weight: bold; text-align: center; padding: 10px; }
            .sub-row td { background-color: #e8edf2; font-size: 10pt;
                          text-align: center; color: #333; padding: 5px; }
            .sum-row td { background-color: #f0f4f8; font-weight: bold; }
            .dept-header td { background-color: #3b5998; color: white;
                              font-size: 11pt; font-weight: bold; padding: 7px; }
            .section-header td { background-color: #4a7ab5; color: white;
                                 font-size: 10pt; font-weight: bold; padding: 6px; }
            .item-header th { background-color: #6b9bd2; }
        </style>`;

    // ────────────────────────────────────────────────────────
    //  1. 종합 현황 (전체 부서 통합)
    // ────────────────────────────────────────────────────────
    function buildOverviewSheet(data, view, period, year) {
        const label = periodLabel(view, period, year);
        const depts = ['system', 'rc', 'communication'];

        let html = `<html><head><meta charset="utf-8">${baseStyle}</head><body>`;
        html += `<table>
            <tr class="title-row"><td colspan="8">비교과센터 종합 현황 보고서</td></tr>
            <tr class="sub-row"><td colspan="8">기간: ${label} | 출력일: ${new Date().toLocaleDateString('ko-KR')}</td></tr>
        </table><br>`;

        // ① 부서별 예산 집계 요약
        html += `<table>
            <tr class="section-header"><td colspan="5">▶ 부서별 예산 집계 요약</td></tr>
            <tr><th>부서</th><th>총 예산액</th><th>총 집행액</th><th>잔액</th><th>집행률</th></tr>`;

        let grandB = 0, grandE = 0;
        depts.forEach(dept => {
            const bList = (data.budget || []).filter(b => !b.deleted && b.department === dept);
            const filtered = filterByPeriodFn(bList, view, period, year);
            const totB = filtered.reduce((s, b) => s + (+b.budgeted_amount || 0), 0);
            const totE = filtered.reduce((s, b) => s + (+b.executed_amount || 0), 0);
            grandB += totB; grandE += totE;
            html += `<tr>
                <td>${deptLabel(dept)}</td>
                <td style="text-align:right">${won(totB)}원</td>
                <td style="text-align:right">${won(totE)}원</td>
                <td style="text-align:right">${won(totB - totE)}원</td>
                <td style="text-align:center">${pctFn(totE, totB)}</td>
            </tr>`;
        });
        html += `<tr class="sum-row">
            <td>합계</td>
            <td style="text-align:right">${won(grandB)}원</td>
            <td style="text-align:right">${won(grandE)}원</td>
            <td style="text-align:right">${won(grandB - grandE)}원</td>
            <td style="text-align:center">${pctFn(grandE, grandB)}</td>
        </tr></table><br>`;

        // ② 부서별 과제 현황 요약
        html += `<table>
            <tr class="section-header"><td colspan="5">▶ 부서별 과제 현황 요약</td></tr>
            <tr><th>부서</th><th>전체</th><th>완료</th><th>진행중</th><th>지연</th></tr>`;
        depts.forEach(dept => {
            const tList = filterByPeriodFn(
                (data.tasks || []).filter(t => !t.deleted && t.department === dept),
                view, period, year
            );
            html += `<tr>
                <td>${deptLabel(dept)}</td>
                <td style="text-align:center">${tList.length}</td>
                <td style="text-align:center">${tList.filter(t => t.status === 'done').length}</td>
                <td style="text-align:center">${tList.filter(t => t.status === 'in_progress').length}</td>
                <td style="text-align:center">${tList.filter(t => t.status === 'delayed').length}</td>
            </tr>`;
        });
        html += `</table><br>`;

        // ③ 세목별 집행 현황
        html += buildBudgetByItemSheet(data.budget || [], view, period, year, true);

        html += `</body></html>`;
        return html;
    }

    // ────────────────────────────────────────────────────────
    //  2. 예산 상세 (세목별)
    // ────────────────────────────────────────────────────────
    function buildBudgetSheet(budgetList, view, period, year, dept) {
        const label = periodLabel(view, period, year);
        const filtered = filterByPeriodFn(budgetList, view, period, year);

        let html = `<html><head><meta charset="utf-8">${baseStyle}</head><body>`;
        html += `<table>
            <tr class="title-row"><td colspan="8">예산 집행 내역</td></tr>
            <tr class="sub-row"><td colspan="8">부서: ${deptLabel(dept)} | 기간: ${label} | 출력일: ${new Date().toLocaleDateString('ko-KR')}</td></tr>
        </table><br>`;

        // 세목별 그룹핑
        const grouped = {};
        BUDGET_ITEMS.forEach(item => { grouped[item.value] = []; });
        filtered.forEach(b => {
            const key = b.budget_item || b.category || '기타';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(b);
        });

        let grandB = 0, grandE = 0;
        BUDGET_ITEMS.forEach(item => {
            const rows = grouped[item.value] || [];
            if (rows.length === 0) return;
            const subB = rows.reduce((s, b) => s + (+b.budgeted_amount || 0), 0);
            const subE = rows.reduce((s, b) => s + (+b.executed_amount || 0), 0);
            grandB += subB; grandE += subE;

            html += `<table>
                <tr class="section-header"><td colspan="8">▶ ${item.label}</td></tr>
                <tr><th>프로그램</th><th>항목명</th><th>담당자</th><th>예산액(원)</th><th>집행액(원)</th><th>잔액(원)</th><th>집행률</th><th>집행일</th></tr>`;
            rows.forEach(b => {
                const r = pctFn(+b.executed_amount || 0, +b.budgeted_amount || 0);
                html += `<tr>
                    <td>${esc(b.program_name || '-')}</td>
                    <td>${esc(b.title)}</td>
                    <td>${esc(b.assignee_name || '-')}</td>
                    <td style="text-align:right">${won(b.budgeted_amount)}</td>
                    <td style="text-align:right">${won(b.executed_amount)}</td>
                    <td style="text-align:right">${won((+b.budgeted_amount || 0) - (+b.executed_amount || 0))}</td>
                    <td style="text-align:center">${r}</td>
                    <td style="text-align:center">${b.execution_date || '-'}</td>
                </tr>`;
            });
            html += `<tr class="sum-row">
                <td colspan="3">소계</td>
                <td style="text-align:right">${won(subB)}</td>
                <td style="text-align:right">${won(subE)}</td>
                <td style="text-align:right">${won(subB - subE)}</td>
                <td style="text-align:center">${pctFn(subE, subB)}</td>
                <td></td>
            </tr></table><br>`;
        });

        // 합계
        html += `<table>
            <tr class="sum-row">
                <td colspan="3" style="font-size:11pt;font-weight:bold">총 합계</td>
                <td style="text-align:right;font-size:11pt;font-weight:bold">${won(grandB)}원</td>
                <td style="text-align:right;font-size:11pt;font-weight:bold">${won(grandE)}원</td>
                <td style="text-align:right;font-size:11pt;font-weight:bold">${won(grandB - grandE)}원</td>
                <td style="text-align:center;font-size:11pt;font-weight:bold">${pctFn(grandE, grandB)}</td>
                <td></td>
            </tr>
        </table>`;

        html += `</body></html>`;
        return html;
    }

    // ────────────────────────────────────────────────────────
    //  3. 프로그램별 예산 집계
    // ────────────────────────────────────────────────────────
    function buildProgramBudgetSheet(budgetList, programList, view, period, year, dept) {
        const label = periodLabel(view, period, year);
        const filteredB = filterByPeriodFn(budgetList, view, period, year);

        let html = `<html><head><meta charset="utf-8">${baseStyle}</head><body>`;
        html += `<table>
            <tr class="title-row"><td colspan="7">프로그램별 예산 집계</td></tr>
            <tr class="sub-row"><td colspan="7">부서: ${deptLabel(dept)} | 기간: ${label} | 출력일: ${new Date().toLocaleDateString('ko-KR')}</td></tr>
        </table><br>`;

        html += `<table>
            <tr><th>프로그램명</th><th>담당자</th><th>세목</th><th>예산액(원)</th><th>집행액(원)</th><th>잔액(원)</th><th>집행률</th></tr>`;

        let grandB = 0, grandE = 0;

        // 프로그램별 그룹핑
        const progMap = {};
        filteredB.forEach(b => {
            const key = b.program_id || 'none';
            if (!progMap[key]) progMap[key] = [];
            progMap[key].push(b);
        });

        (programList || []).forEach(prog => {
            const rows = progMap[prog.id] || [];
            const subB = rows.reduce((s, b) => s + (+b.budgeted_amount || 0), 0);
            const subE = rows.reduce((s, b) => s + (+b.executed_amount || 0), 0);
            grandB += subB; grandE += subE;

            if (rows.length === 0) {
                html += `<tr>
                    <td>${esc(prog.name)}</td>
                    <td>${esc(prog.assignee_name || '-')}</td>
                    <td>-</td>
                    <td style="text-align:right">-</td>
                    <td style="text-align:right">-</td>
                    <td style="text-align:right">-</td>
                    <td style="text-align:center">-</td>
                </tr>`;
                return;
            }

            // 세목별 소계
            const itemTotals = {};
            rows.forEach(b => {
                const k = b.budget_item || '기타';
                if (!itemTotals[k]) itemTotals[k] = { b: 0, e: 0 };
                itemTotals[k].b += +b.budgeted_amount || 0;
                itemTotals[k].e += +b.executed_amount || 0;
            });

            let first = true;
            Object.entries(itemTotals).forEach(([item, tot]) => {
                html += `<tr>
                    <td>${first ? esc(prog.name) : ''}</td>
                    <td>${first ? esc(prog.assignee_name || '-') : ''}</td>
                    <td>${esc(item)}</td>
                    <td style="text-align:right">${won(tot.b)}</td>
                    <td style="text-align:right">${won(tot.e)}</td>
                    <td style="text-align:right">${won(tot.b - tot.e)}</td>
                    <td style="text-align:center">${pctFn(tot.e, tot.b)}</td>
                </tr>`;
                first = false;
            });

            html += `<tr class="sum-row">
                <td colspan="3">${esc(prog.name)} 소계</td>
                <td style="text-align:right">${won(subB)}</td>
                <td style="text-align:right">${won(subE)}</td>
                <td style="text-align:right">${won(subB - subE)}</td>
                <td style="text-align:center">${pctFn(subE, subB)}</td>
            </tr>`;
        });

        html += `<tr class="sum-row">
            <td colspan="3" style="font-size:11pt;font-weight:bold">총 합계</td>
            <td style="text-align:right;font-size:11pt;font-weight:bold">${won(grandB)}</td>
            <td style="text-align:right;font-size:11pt;font-weight:bold">${won(grandE)}</td>
            <td style="text-align:right;font-size:11pt;font-weight:bold">${won(grandB - grandE)}</td>
            <td style="text-align:center;font-size:11pt;font-weight:bold">${pctFn(grandE, grandB)}</td>
        </tr>
        </table></body></html>`;

        return html;
    }

    // ────────────────────────────────────────────────────────
    //  4. 과제 목록
    // ────────────────────────────────────────────────────────
    function buildTasksSheet(taskList, view, period, year, dept) {
        const label = periodLabel(view, period, year);
        const filtered = filterByPeriodFn(taskList, view, period, year);

        let html = `<html><head><meta charset="utf-8">${baseStyle}</head><body>`;
        html += `<table>
            <tr class="title-row"><td colspan="8">업무 과제 목록</td></tr>
            <tr class="sub-row"><td colspan="8">부서: ${deptLabel(dept)} | 기간: ${label} | 출력일: ${new Date().toLocaleDateString('ko-KR')}</td></tr>
            <tr><th>과제명</th><th>프로그램</th><th>담당자</th><th>우선순위</th><th>상태</th><th>시작일</th><th>마감일</th><th>비고</th></tr>`;

        const prioMap = { high:'높음', medium:'중간', low:'낮음' };
        const statusMap = { todo:'예정', in_progress:'진행중', done:'완료', delayed:'지연' };

        if (filtered.length === 0) {
            html += `<tr><td colspan="8" style="text-align:center;color:#999">데이터 없음</td></tr>`;
        } else {
            filtered.forEach(t => {
                html += `<tr>
                    <td>${esc(t.title)}</td>
                    <td>${esc(t.program_name || '-')}</td>
                    <td>${esc(t.assignee_name || '-')}</td>
                    <td style="text-align:center">${prioMap[t.priority] || t.priority}</td>
                    <td style="text-align:center">${statusMap[t.status] || t.status}</td>
                    <td style="text-align:center">${t.start_date || '-'}</td>
                    <td style="text-align:center">${t.due_date || '-'}</td>
                    <td>${esc(t.note || '')}</td>
                </tr>`;
            });
        }

        // 상태별 요약
        const done = filtered.filter(t => t.status === 'done').length;
        const total = filtered.length;
        html += `<tr class="sum-row">
            <td colspan="8">총 ${total}건 | 완료 ${done}건 | 
            완료율 ${total > 0 ? Math.round(done/total*100) : 0}%</td>
        </tr>`;

        html += `</table></body></html>`;
        return html;
    }

    // ────────────────────────────────────────────────────────
    //  5. 세목별 전체 집계 (overview용 helper)
    // ────────────────────────────────────────────────────────
    function buildBudgetByItemSheet(budgetList, view, period, year, inline = false) {
        const filtered = filterByPeriodFn(budgetList, view, period, year);
        const grouped = {};
        BUDGET_ITEMS.forEach(item => { grouped[item.value] = { b: 0, e: 0 }; });
        filtered.forEach(b => {
            const key = b.budget_item || b.category || '기타';
            if (!grouped[key]) grouped[key] = { b: 0, e: 0 };
            grouped[key].b += +b.budgeted_amount || 0;
            grouped[key].e += +b.executed_amount || 0;
        });

        let html = '';
        if (!inline) html = `<html><head><meta charset="utf-8">${baseStyle}</head><body>`;

        html += `<table>
            <tr class="section-header"><td colspan="5">▶ 세목별 예산 집계 현황</td></tr>
            <tr><th>예산 세목</th><th>예산액(원)</th><th>집행액(원)</th><th>잔액(원)</th><th>집행률</th></tr>`;

        let grandB = 0, grandE = 0;
        BUDGET_ITEMS.forEach(item => {
            const d = grouped[item.value] || { b: 0, e: 0 };
            grandB += d.b; grandE += d.e;
            html += `<tr>
                <td>${item.label}</td>
                <td style="text-align:right">${won(d.b)}</td>
                <td style="text-align:right">${won(d.e)}</td>
                <td style="text-align:right">${won(d.b - d.e)}</td>
                <td style="text-align:center">${pctFn(d.e, d.b)}</td>
            </tr>`;
        });

        html += `<tr class="sum-row">
            <td>합계</td>
            <td style="text-align:right">${won(grandB)}</td>
            <td style="text-align:right">${won(grandE)}</td>
            <td style="text-align:right">${won(grandB - grandE)}</td>
            <td style="text-align:center">${pctFn(grandE, grandB)}</td>
        </tr></table>`;

        if (!inline) html += `<br></body></html>`;
        return html;
    }

    // ────────────────────────────────────────────────────────
    //  기간 필터 헬퍼
    // ────────────────────────────────────────────────────────
    function filterByPeriodFn(arr, view, period, year) {
        return arr.filter(item => {
            if (!item || item.deleted) return false;
            if (year && item.year && +item.year !== +year) return false;
            if (view === 'monthly'   && period && item.month    && +item.month    !== +period) return false;
            if (view === 'quarterly' && period && item.quarter  && +item.quarter  !== +period) return false;
            return true;
        });
    }

    // ────────────────────────────────────────────────────────
    //  공개 API
    // ────────────────────────────────────────────────────────
    return {
        // 팀장: 종합 현황 다운로드
        downloadOverview(data, view, period, year) {
            const label = periodLabel(view, period, year).replace(/\s/g, '_');
            const html = buildOverviewSheet(data, view, period, year);
            downloadXLS(html, `비교과센터_종합현황_${label}`);
        },

        // 팀장/직원: 예산 집행 내역 (세목별)
        downloadBudget(budgetList, view, period, year, dept) {
            const label = periodLabel(view, period, year).replace(/\s/g, '_');
            const html = buildBudgetSheet(budgetList, view, period, year, dept);
            downloadXLS(html, `${deptLabel(dept)}_예산집행_${label}`);
        },

        // 팀장/직원: 프로그램별 예산 집계
        downloadProgramBudget(budgetList, programList, view, period, year, dept) {
            const label = periodLabel(view, period, year).replace(/\s/g, '_');
            const html = buildProgramBudgetSheet(budgetList, programList, view, period, year, dept);
            downloadXLS(html, `${deptLabel(dept)}_프로그램별예산_${label}`);
        },

        // 팀장/직원: 과제 목록
        downloadTasks(taskList, view, period, year, dept) {
            const label = periodLabel(view, period, year).replace(/\s/g, '_');
            const html = buildTasksSheet(taskList, view, period, year, dept);
            downloadXLS(html, `${deptLabel(dept)}_업무과제_${label}`);
        },

        // 세목별 집계만
        downloadBudgetByItem(budgetList, view, period, year, dept) {
            const label = periodLabel(view, period, year).replace(/\s/g, '_');
            let html = `<html><head><meta charset="utf-8">${baseStyle}</head><body>`;
            html += `<table><tr class="title-row"><td colspan="5">세목별 예산 집계 현황</td></tr>
                <tr class="sub-row"><td colspan="5">부서: ${deptLabel(dept)} | 기간: ${label} | 출력일: ${new Date().toLocaleDateString('ko-KR')}</td></tr>
                </table><br>`;
            html += buildBudgetByItemSheet(budgetList, view, period, year, true);
            html += `</body></html>`;
            downloadXLS(html, `${deptLabel(dept)}_세목별집계_${label}`);
        }
    };
})();
