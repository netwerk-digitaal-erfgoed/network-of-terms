# Running the tests

For simplicity and because we have integration tests (versus separate unit tests for each package) we want to combine
code coverage for all tests. To run the tests, first clone the repository and install its dependencies:
    
    git clone https://github.com/netwerk-digitaal-erfgoed/network-of-terms.git
    cd network-of-terms
    npm install

Then run the tests from the repository’s root directory:

    npm run test
