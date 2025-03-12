//
//  Item.swift
//  WebsiteApp
//
//  Created by GUILLERMO VILLANUEVA on 3/11/25.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
