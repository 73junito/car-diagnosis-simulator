export function progressCard({
  title="Overall Progress",
  value=0,
  total=100,
  footer=""
}={}){

  const percent =
      total > 0
      ? Math.round((value/total)*100)
      : 0;

  return `
<section class="tm-progress-card">

<h2 class="tm-progress-card__title">${title}</h2>

<div class="tm-progress-card__value">
${percent}%
</div>

<div class="tm-progress-card__bar">

<span
class="tm-progress-card__fill"
style="width:${percent}%">
</span>

</div>

${
footer
? `<div class="tm-progress-card__footer">${footer}</div>`
: ""
}

</section>
`;

}
