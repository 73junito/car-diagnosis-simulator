export function createCard(title,body){
    return `
    <section class="tm-card">
        <div class="tm-card-header">${title}</div>
        <div class="tm-card-body">${body}</div>
    </section>`;
}
