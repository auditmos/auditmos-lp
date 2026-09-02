/** Browser-local theme preference shared by every rendered page. */
export const THEME_STORAGE_KEY = "auditmos-theme";

/**
 * The complete client-side theme controller.
 *
 * Kept inline and deliberately small: it must restore an explicit preference
 * from localStorage before the body paints. `system` needs no media-query
 * listener because CSS `color-scheme` + `light-dark()` follows OS changes.
 */
export function renderThemeScript(): string {
	return `(()=>{const d=document.documentElement,k="${THEME_STORAGE_KEY}",v=["light","dark"],r=()=>{try{const t=localStorage.getItem(k);return v.includes(t)?t:"system"}catch{return"system"}},a=t=>{d.dataset.theme=t},s=t=>{try{t==="system"?localStorage.removeItem(k):localStorage.setItem(k,t)}catch{}},i=()=>{const e=document.querySelector("[data-theme-select]");if(!(e instanceof HTMLSelectElement))return;let t=r();e.value=t;e.addEventListener("change",()=>{t=v.includes(e.value)?e.value:"system";a(t);s(t)})};a(r());document.readyState==="loading"?document.addEventListener("DOMContentLoaded",i,{once:true}):i()})();`;
}
