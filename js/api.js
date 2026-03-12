// ============================================================
//  api.js  — 데이터 저장소 추상화 레이어
//  Supabase가 설정되면 Supabase 사용, 아니면 localStorage 폴백
// ============================================================

const DB = (() => {

    // ── Supabase 연결 여부 확인 ──────────────────────────────
    function isSupabaseReady() {
        return (
            typeof SUPABASE_URL !== 'undefined' &&
            SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
            typeof SUPABASE_ANON_KEY !== 'undefined' &&
            SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
        );
    }

    // ── Supabase REST API 헬퍼 ───────────────────────────────
    const SB = {
        headers() {
            return {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            };
        },
        url(table, query = '') {
            return `${SUPABASE_URL}/rest/v1/${table}${query}`;
        },
        async select(table, filters = {}) {
            let q = '?select=*&order=created_at.desc';
            Object.entries(filters).forEach(([k, v]) => {
                q += `&${k}=eq.${encodeURIComponent(v)}`;
            });
            const res = await fetch(SB.url(table, q), { headers: SB.headers() });
            if (!res.ok) throw new Error(`Supabase SELECT 오류: ${res.status}`);
            return res.json();
        },
        async insert(table, data) {
            const res = await fetch(SB.url(table), {
                method: 'POST',
                headers: SB.headers(),
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`Supabase INSERT 오류: ${res.status}`);
            const result = await res.json();
            return Array.isArray(result) ? result[0] : result;
        },
        async update(table, id, data) {
            const res = await fetch(SB.url(table, `?id=eq.${id}`), {
                method: 'PATCH',
                headers: SB.headers(),
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`Supabase UPDATE 오류: ${res.status}`);
            const result = await res.json();
            return Array.isArray(result) ? result[0] : result;
        },
        async delete(table, id) {
            const res = await fetch(SB.url(table, `?id=eq.${id}`), {
                method: 'DELETE',
                headers: SB.headers()
            });
            if (!res.ok) throw new Error(`Supabase DELETE 오류: ${res.status}`);
        }
    };

    // ── localStorage 폴백 헬퍼 ──────────────────────────────
    const LS = {
        key(table) { return `dashboard_${table}`; },
        all(table) {
            return JSON.parse(localStorage.getItem(LS.key(table)) || '[]');
        },
        save(table, rows) {
            localStorage.setItem(LS.key(table), JSON.stringify(rows));
        },
        newId() {
            return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        },
        async select(table, filters = {}) {
            let rows = LS.all(table).filter(r => !r.deleted);
            Object.entries(filters).forEach(([k, v]) => {
                rows = rows.filter(r => String(r[k]) === String(v));
            });
            return rows.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        },
        async insert(table, data) {
            const rows = LS.all(table);
            const newRow = {
                ...data,
                id: LS.newId(),
                created_at: Date.now(),
                updated_at: Date.now()
            };
            rows.push(newRow);
            LS.save(table, rows);
            return newRow;
        },
        async update(table, id, data) {
            const rows = LS.all(table);
            const idx = rows.findIndex(r => r.id === id);
            if (idx === -1) throw new Error('레코드를 찾을 수 없습니다: ' + id);
            rows[idx] = { ...rows[idx], ...data, updated_at: Date.now() };
            LS.save(table, rows);
            return rows[idx];
        },
        async delete(table, id) {
            const rows = LS.all(table);
            const idx = rows.findIndex(r => r.id === id);
            if (idx !== -1) {
                rows[idx].deleted = true;
                rows[idx].updated_at = Date.now();
                LS.save(table, rows);
            }
        }
    };

    // ── 공개 API (자동 라우팅) ───────────────────────────────
    const driver = () => isSupabaseReady() ? SB : LS;

    return {
        isSupabase: isSupabaseReady,

        async getAll(table, filters = {}) {
            return driver().select(table, filters);
        },
        async create(table, data) {
            return driver().insert(table, data);
        },
        async update(table, id, data) {
            return driver().update(table, id, data);
        },
        async remove(table, id) {
            return driver().delete(table, id);
        },

        // 저장소 상태 표시
        storageLabel() {
            return isSupabaseReady()
                ? '☁️ Supabase (클라우드)'
                : '💾 브라우저 로컬 저장소 (임시)';
        }
    };
})();
