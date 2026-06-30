export function breadcrumbs(items = []) {
  if (!items.length) return "";

  return `
    <nav class="tm-breadcrumbs" aria-label="Breadcrumb">
      ${items.map((item, index) => {
        const isLast = index === items.length - 1;
        return isLast
          ? `<span aria-current="page">${item.label}</span>`
          : `<a href="${item.href}">${item.label}</a>`;
      }).join(" / ")}
    </nav>
  `;
}
