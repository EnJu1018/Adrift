import Foundation

struct AuthResponse: Decodable {
    let token: String
    let user: User
}

struct RegisterResponse: Decodable {
    let user: User
}
