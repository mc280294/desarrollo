/**
 * Lógica principal del Buscador de Rubros Históricos
 */

// Constantes para optimización y evitar "Magic Strings"
const COL_YEAR = 'y';
const COL_DESC = 'd';
const COL_PRICE = 'p';
const COL_UNIT = 'u';
const COL_PROJ = 'pr';
const COL_CAT = 'c';

function appData() {
    return {
        rubros: [],
        loading: true,
        waitingForFile: false,
        fuenteDatos: '',
        
        busquedaDescripcion: '',
        busquedaProyecto: '',
        
        // Selección Múltiple
        aniosSeleccionados: [],
        categoriasSeleccionadas: [],
        unidadesSeleccionadas: [],
        proyectosSeleccionados: [],
        
        // Estados de Dropdowns
        anioDropdownOpen: false,
        categoriaDropdownOpen: false,
        unidadDropdownOpen: false,
        proyectoDropdownOpen: false,
        
        // Buscadores internos de Dropdowns
        anioBusquedaInterna: '',
        categoriaBusquedaInterna: '',
        unidadBusquedaInterna: '',
        proyectoBusquedaInterna: '',
        
        // Optimizaciones de búsqueda
        busquedaPartesD: [],
        busquedaPartesPR: [],
        esMultiBusquedaD: false,
        esMultiBusquedaPR: false,
        isFiltering: false,
        
        orden: COL_YEAR,
        ordenDir: -1,
        paginaActual: 1,
        porPagina: 50,
        
        // Cache del motor de filtrado
        filteredResults: [],
        _opcionesAnios: [],
        _opcionesCat: [],
        _opcionesUnidad: [],
        _opcionesProyecto: [],
        
        // Usamos Array para mejor reactividad en Alpine en vez de Set
        rubrosFijados: [],
        mostrarSoloFijados: false,
        
        exportDropdownOpen: false,
        
        themeMode: 'auto',
        mediaQueryTheme: null,
        themeMediaHandler: null,

        initApp() {
            this.initTheme();
            
            const pr = () => {
                this.isFiltering = true;
                // Pequeño timeout para permitir a la UI renderizar el spinner si los datos son pesados
                setTimeout(() => {
                    this.pruneFilterSelections();
                    this.isFiltering = false;
                }, 10);
            };
            
            this.$watch('busquedaDescripcion', val => {
                this.processSearchPatron('D', val);
                this.paginaActual = 1;
                pr();
            });

            this.$watch('busquedaProyecto', val => {
                this.processSearchPatron('PR', val);
                this.paginaActual = 1;
                pr();
            });

            this.$watch('aniosSeleccionados', () => { this.paginaActual = 1; pr(); }, { deep: true });
            this.$watch('categoriasSeleccionadas', () => { this.paginaActual = 1; pr(); }, { deep: true });
            this.$watch('unidadesSeleccionadas', () => { this.paginaActual = 1; pr(); }, { deep: true });
            this.$watch('proyectosSeleccionados', () => { this.paginaActual = 1; pr(); }, { deep: true });
            
            this.$watch('mostrarSoloFijados', pr);
            
            this.cargarDatosAutomatico();
        },

        processSearchPatron(type, val) {
            const patron = (val || '').trim().toLowerCase();
            let partes = [];
            let multi = false;
            
            if (patron) {
                if (patron.includes('*')) {
                    partes = patron.split('*').filter(p => p.trim().length > 0).map(p => p.trim());
                    multi = true;
                } else {
                    partes = patron.split(/\s+/).filter(p => p.length > 0);
                }
            }
            
            if (type === 'D') {
                this.busquedaPartesD = partes;
                this.esMultiBusquedaD = multi;
            } else {
                this.busquedaPartesPR = partes;
                this.esMultiBusquedaPR = multi;
            }
        },

        updateFilteredData() {
            if (this.loading) return;
            
            const start = performance.now();
            
            const anioSels = this.aniosSeleccionados.length > 0 ? new Set(this.aniosSeleccionados) : null;
            const catSels = this.categoriasSeleccionadas.length > 0 ? new Set(this.categoriasSeleccionadas) : null;
            const uniSels = this.unidadesSeleccionadas.length > 0 ? new Set(this.unidadesSeleccionadas) : null;
            const proySels = this.proyectosSeleccionados.length > 0 ? new Set(this.proyectosSeleccionados) : null;
            
            const partsD = this.busquedaPartesD;
            const partsPR = this.busquedaPartesPR;
            const soloFijados = this.mostrarSoloFijados;
            const fijadosSet = new Set(this.rubrosFijados); // Optimizamos lookup creando un set local

            const resAnio = new Set();
            const resCat = new Set();
            const resUni = new Set();
            const resProy = new Set();
            const resFinal = [];

            const data = this.rubros;
            const len = data.length;

            for (let i = 0; i < len; i++) {
                const r = data[i];
                
                const ry = r._y;
                const rc = r._c;
                const ru = r._u;
                const rpr = r._pr;
                const rd_low = r._d_low;
                const rpr_low = r._pr_low;

                const mAnio = !anioSels || anioSels.has(ry);
                const mCat = !catSels || catSels.has(rc);
                const mUni = !uniSels || uniSels.has(ru);
                const mProy = !proySels || proySels.has(rpr);
                const mFij = !soloFijados || fijadosSet.has(r._uid);
                
                let mTextD = true;
                if (partsD.length > 0) {
                    for(let j=0; j<partsD.length; j++) {
                        if (!rd_low.includes(partsD[j])) { mTextD = false; break; }
                    }
                }
                
                let mTextPR = true;
                if (partsPR.length > 0) {
                    for(let j=0; j<partsPR.length; j++) {
                        if (!rpr_low.includes(partsPR[j])) { mTextPR = false; break; }
                    }
                }

                const mGlobal = mTextD && mTextPR && mFij;

                if (mAnio && mCat && mUni && mProy && mGlobal) {
                    resFinal.push(r);
                }

                if (mCat && mUni && mProy && mGlobal) resAnio.add(ry);
                if (mAnio && mUni && mProy && mGlobal) resCat.add(rc);
                if (mAnio && mCat && mProy && mGlobal) resUni.add(ru);
                if (mAnio && mCat && mUni && mGlobal) resProy.add(rpr);
            }

            this.filteredResults = resFinal;
            this._opcionesAnios = Array.from(resAnio).sort((a,b) => b-a);
            this._opcionesCat = Array.from(resCat).sort();
            this._opcionesUnidad = Array.from(resUni).sort();
            this._opcionesProyecto = Array.from(resProy).sort();
            
            this.sortResults();
            console.log(`Filtrado completado en ${performance.now() - start}ms`);
        },

        sortResults() {
            const col = this.orden;
            const dir = this.ordenDir;
            this.filteredResults.sort((a, b) => {
                let valA = a[col] ?? '';
                let valB = b[col] ?? '';
                if (typeof valA === 'string') {
                    if (valA < valB) return -1 * dir;
                    if (valA > valB) return 1 * dir;
                } else {
                    return (valA - valB) * dir;
                }
                return 0;
            });
        },

        initTheme() {
            const savedMode = localStorage.getItem('ripconciv_theme_mode');
            this.themeMode = ['auto', 'dark', 'light'].includes(savedMode) ? savedMode : 'auto';
            this.applyTheme();

            this.mediaQueryTheme = window.matchMedia('(prefers-color-scheme: dark)');
            this.themeMediaHandler = () => {
                if (this.themeMode === 'auto') {
                    this.applyTheme();
                }
            };

            if (this.mediaQueryTheme.addEventListener) {
                this.mediaQueryTheme.addEventListener('change', this.themeMediaHandler);
            } else if (this.mediaQueryTheme.addListener) {
                this.mediaQueryTheme.addListener(this.themeMediaHandler);
            }
        },

        applyTheme() {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const useDark = this.themeMode === 'dark' || (this.themeMode === 'auto' && prefersDark);
            document.documentElement.classList.toggle('dark', useDark);
        },

        cycleTheme() {
            const nextMode = this.themeMode === 'auto'
                ? 'dark'
                : (this.themeMode === 'dark' ? 'light' : 'auto');
            this.themeMode = nextMode;
            localStorage.setItem('ripconciv_theme_mode', nextMode);
            this.applyTheme();
        },

        get themeLabel() {
            if (this.themeMode === 'dark') return 'Oscuro';
            if (this.themeMode === 'light') return 'Claro';
            return 'Auto';
        },

        get themeIcon() {
            if (this.themeMode === 'dark') return 'fa-moon';
            if (this.themeMode === 'light') return 'fa-sun';
            return 'fa-circle-half-stroke';
        },

        async cargarDatosAutomatico() {
            this.loading = true;
            this.waitingForFile = false;

            if (typeof RUBROS_DATA !== 'undefined' && Array.isArray(RUBROS_DATA)) {
                console.log("Cargando datos desde preciosripconciv.js...");
                this.fuenteDatos = 'preciosripconciv.js';
                this.cargarRubrosDesdeJS(RUBROS_DATA);
                return;
            }

            try {
                console.log("Intentando cargar desde preciosripconciv.csv...");
                this.fuenteDatos = 'preciosripconciv.csv';
                
                // Optimizacion: Evitamos el 'no-store' si no es necesario para beneficiarnos del caché,
                // Si requieres invalidación, usar un fetch con ETag o cache:'default' es mejor práctica
                const response = await fetch('preciosripconciv.csv', { cache: 'default' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const csvText = await response.text();
                this.cargarRubrosDesdeCSV(csvText);
            } catch (err) {
                this.loading = false;
                this.waitingForFile = true;
                console.warn("No se encontraron datos automáticos. Por favor, seleccione el archivo manualmente.", err);
            }
        },

        normalizarRubros(datos) {
            return datos.map((r, i) => {
                const y = String(r[COL_YEAR] ?? '').trim();
                const c = String(r[COL_CAT] ?? '').trim();
                const u = String(r[COL_UNIT] ?? '').trim();
                const pr = String(r[COL_PROJ] ?? '').trim();
                const d = String(r[COL_DESC] ?? '').trim();
                return {
                    ...r,
                    _uid: i,
                    y, c, u, pr, d,
                    _y: y,
                    _c: c,
                    _u: u,
                    _pr: pr,
                    _d_low: d.toLowerCase(),
                    _pr_low: pr.toLowerCase()
                };
            });
        },

        cargarRubrosDesdeJS(datos) {
            if (!Array.isArray(datos) || datos.length === 0) {
                throw new Error("El archivo de datos está vacío.");
            }
            this.rubros = this.normalizarRubros(datos);
            this.loading = false;
            this.waitingForFile = false;
            this.$nextTick(() => { this.updateFilteredData(); });
        },

        handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.fuenteDatos = file.name;
            this.loading = true;
            this.waitingForFile = false;

            // PapaParse permite pasar directamente el File Object
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const mappedRows = this.processPapaParseResults(results.data, results.meta.fields);
                        this.cargarRubrosDesdeJS(mappedRows);
                    } catch (err) {
                        this.loading = false;
                        this.waitingForFile = true;
                        alert("Error al procesar el archivo: " + err.message);
                    }
                },
                error: (error) => {
                    this.loading = false;
                    this.waitingForFile = true;
                    alert("Error al leer el archivo CSV: " + error.message);
                }
            });
        },

        cargarRubrosDesdeCSV(csvText) {
            // Uso de PapaParse para texto CSV
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const mappedRows = this.processPapaParseResults(results.data, results.meta.fields);
                    if (!mappedRows || mappedRows.length === 0) {
                        this.loading = false;
                        this.waitingForFile = true;
                        console.error("El CSV está vacío o no contiene filas válidas.");
                        return;
                    }
                    this.cargarRubrosDesdeJS(mappedRows);
                },
                error: (error) => {
                    console.error(error);
                }
            });
        },

        processPapaParseResults(data, fields) {
            // Normalizar las cabeceras a minúsculas sin acentos
            const normalizeHeader = h => (h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
            const normalizedFields = fields.map(normalizeHeader);
            
            const mappedRows = [];

            for (let row of data) {
                // Crear un objeto con las llaves normalizadas
                const normalizedRow = {};
                fields.forEach((field, index) => {
                    normalizedRow[normalizedFields[index]] = (row[field] || '').trim();
                });

                const mapped = this.mapRowToRubro(normalizedRow);
                if (mapped[COL_DESC]) {
                    mappedRows.push(mapped);
                }
            }

            return mappedRows;
        },

        mapRowToRubro(row) {
            const get = (...keys) => {
                for (const key of keys) {
                    if (row[key] !== undefined && row[key] !== '') return row[key];
                }
                return '';
            };

            const rawPrice = get('preciousd', 'precio', 'p', 'valor');
            const normalizedPrice = this.parsePrice(rawPrice);

            return {
                [COL_YEAR]: get('ano', 'year', 'y'),
                [COL_DESC]: get('descripcion', 'detalle', 'rubro', 'd'),
                [COL_PRICE]: normalizedPrice,
                [COL_UNIT]: get('unidad', 'u'),
                [COL_PROJ]: get('proyecto', 'nombreproyecto', 'pr'),
                [COL_CAT]: get('categoria', 'rubrocategoria', 'c')
            };
        },

        parsePrice(value) {
            if (typeof value === 'number') return value;
            const text = String(value || '').trim();
            if (!text) return 0;

            const cleaned = text.replace(/[^\d,.-]/g, '');
            const hasComma = cleaned.includes(',');
            const hasDot = cleaned.includes('.');

            if (hasComma && hasDot) {
                if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
                    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
                }
                return Number(cleaned.replace(/,/g, '')) || 0;
            }

            if (hasComma) {
                return Number(cleaned.replace(',', '.')) || 0;
            }
            return Number(cleaned) || 0;
        },

        reintentarCarga() {
            this.cargarDatosAutomatico();
        },

        toggleFijar(item) {
            const idx = this.rubrosFijados.indexOf(item._uid);
            if (idx > -1) {
                this.rubrosFijados.splice(idx, 1);
            } else {
                this.rubrosFijados.push(item._uid);
            }
        },

        desfijarTodos() {
            this.rubrosFijados = [];
        },

        pruneFilterSelections() {
            this.updateFilteredData();
        },

        get opcionesAnios() { return this._opcionesAnios || []; },
        get opcionesCat() { return this._opcionesCat || []; },
        get opcionesUnidad() { return this._opcionesUnidad || []; },
        get opcionesProyecto() { return this._opcionesProyecto || []; },

        get filteredRubros() {
            return this.filteredResults || [];
        },

        get hasActiveFilters() {
            return this.busquedaDescripcion !== '' || 
                   this.busquedaProyecto !== '' || 
                   this.aniosSeleccionados.length > 0 ||
                   this.categoriasSeleccionadas.length > 0 ||
                   this.unidadesSeleccionadas.length > 0 ||
                   this.proyectosSeleccionados.length > 0 ||
                   this.mostrarSoloFijados;
        },

        toggleSeleccion(storage, val) {
            const idx = this[storage].indexOf(val);
            if (idx > -1) {
                this[storage].splice(idx, 1);
            } else {
                this[storage].push(val);
            }
        },

        seleccionarTodos(key, storage) {
            const available = (key === 'y') ? this.opcionesAnios : (key === 'c' ? this.opcionesCat : (key === 'u' ? this.opcionesUnidad : this.opcionesProyecto));
            this[storage] = [...available];
        },

        limpiarSeleccion(storage) {
            this[storage] = [];
        },
        
        get itemsFiltradosAnio() {
            const p = this.anioBusquedaInterna.toLowerCase();
            return this.opcionesAnios.filter(a => String(a).includes(p));
        },
        
        get itemsFiltradosCat() {
            const p = this.categoriaBusquedaInterna.toLowerCase();
            return this.opcionesCat.filter(c => c.toLowerCase().includes(p));
        },
        
        get itemsFiltradosUni() {
            const p = this.unidadBusquedaInterna.toLowerCase();
            return this.opcionesUnidad.filter(u => u.toLowerCase().includes(p));
        },
        
        get itemsFiltradosProy() {
            const p = this.proyectoBusquedaInterna.toLowerCase();
            return this.opcionesProyecto.filter(pr => pr.toLowerCase().includes(p));
        },

        get totalPaginas() {
            return Math.ceil(this.filteredResults.length / this.porPagina) || 1;
        },

        get paginatedRubros() {
            const start = (this.paginaActual - 1) * this.porPagina;
            return this.filteredResults.slice(start, start + this.porPagina);
        },

        resaltarCoincidenciasDescripcion(texto) {
            if (!this.busquedaDescripcion || !texto) return this.escapeHtml(texto);
            
            const patron = this.busquedaDescripcion.trim();
            
            let resultado = this.escapeHtml(texto);
            const patronLower = patron.toLowerCase();
            
            let partes = [];
            if (patron.includes('*')) {
                partes = patronLower.split('*').filter(p => p.trim().length > 0).map(p => p.trim());
            } else {
                partes = patronLower.split(/\s+/).filter(p => p.length > 0);
            }
            
            partes.forEach(parte => {
                const escapedParte = parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedParte})`, 'gi');
                resultado = resultado.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-gray-100 px-0.5 rounded">$1</mark>');
            });
            
            return resultado;
        },

        resaltarCoincidenciasProyecto(texto) {
            if (!this.busquedaProyecto || !texto) return this.escapeHtml(texto);
            
            const patron = this.busquedaProyecto.trim();
            
            let resultado = this.escapeHtml(texto);
            const patronLower = patron.toLowerCase();
            
            let partes = [];
            if (patron.includes('*')) {
                partes = patronLower.split('*').filter(p => p.trim().length > 0).map(p => p.trim());
            } else {
                partes = patronLower.split(/\s+/).filter(p => p.length > 0);
            }
            
            partes.forEach(parte => {
                const escapedParte = parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedParte})`, 'gi');
                resultado = resultado.replace(regex, '<mark class="bg-purple-200 dark:bg-purple-800 text-gray-900 dark:text-gray-100 px-0.5 rounded">$1</mark>');
            });
            
            return resultado;
        },

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        ordenarPor(columna) {
            if (this.orden === columna) {
                this.ordenDir *= -1;
            } else {
                this.orden = columna;
                this.ordenDir = (columna === COL_PRICE || columna === COL_YEAR) ? -1 : 1;
            }
            this.paginaActual = 1;
            this.sortResults();
        },

        resetFilters() {
            this.busquedaDescripcion = '';
            this.busquedaProyecto = '';
            this.aniosSeleccionados = [];
            this.categoriasSeleccionadas = [];
            this.unidadesSeleccionadas = [];
            this.proyectosSeleccionados = [];
            this.anioDropdownOpen = false;
            this.categoriaDropdownOpen = false;
            this.unidadDropdownOpen = false;
            this.proyectoDropdownOpen = false;
            this.mostrarSoloFijados = false;
            this.paginaActual = 1;
        },

        formatearMoneda(valor) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(valor);
        },
        
        truncate(str, n) {
            if (!str) return '';
            return (str.length > n) ? str.substr(0, n-1) + '...' : str;
        },

        exportFiltrados() {
            const data = this.filteredResults;
            if (data.length === 0) {
                alert('No hay datos para exportar');
                return;
            }
            this.downloadCSV(data, 'rubros_filtrados');
        },

        exportFijados() {
            if (this.rubrosFijados.length === 0) {
                alert('No hay rubros fijados para exportar');
                return;
            }
            const fijadosSet = new Set(this.rubrosFijados);
            const data = this.rubros.filter(r => fijadosSet.has(r._uid));
            this.downloadCSV(data, 'rubros_fijados');
        },

        exportarAmbos() {
            const filtrados = this.filteredResults;
            const fijadosSet = new Set(this.rubrosFijados);
            const fijados = this.rubros.filter(r => fijadosSet.has(r._uid));
            
            const combinados = [...filtrados];
            fijados.forEach(f => {
                if (!combinados.find(c => c._uid === f._uid)) {
                    combinados.push(f);
                }
            });
            
            if (combinados.length === 0) {
                alert('No hay datos para exportar');
                return;
            }
            
            this.downloadCSV(combinados, 'rubros_filtrados_y_fijados');
        },

        downloadCSV(data, filename) {
            const fijadosSet = new Set(this.rubrosFijados);
            const headers = ["Año", "Descripción", "Precio (USD)", "Unidad", "Proyecto", "Categoría", "Fijado"];
            
            const rows = data.map(r => [
                r[COL_YEAR], 
                `"${(r[COL_DESC] || '').replace(/"/g, '""')}"`, 
                r[COL_PRICE], 
                `"${(r[COL_UNIT] || '')}"`, 
                `"${(r[COL_PROJ] || '').replace(/"/g, '""')}"`, 
                `"${(r[COL_CAT] || '')}"`,
                fijadosSet.has(r._uid) ? 'Sí' : 'No'
            ]);
            
            const csvContent = "\uFEFF"
                + headers.join(",") + "\n" 
                + rows.map(e => e.join(",")).join("\n");
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }
}
