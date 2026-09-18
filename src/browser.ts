const heading = document.querySelector("h1");

if (heading) {
    heading.textContent = "Loading...";
}

type Product = {
    id: number;
    name: string;
    price: number;
};

const response = await fetch("/api/product");
const product: Product = await response.json();

if (heading) {
    heading.textContent = product.name;
}