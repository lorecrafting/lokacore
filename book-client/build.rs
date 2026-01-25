fn main() {
    // Generate uniffi scaffolding for the bridge
    uniffi::generate_scaffolding("src/loka_book.udl").unwrap();
}
