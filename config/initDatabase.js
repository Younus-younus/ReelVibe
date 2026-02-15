require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
    let connection;
    
    try {
        // Connect to MySQL without database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT
        });

        console.log('📡 Connected to MySQL server');

        // Create database if not exists
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        console.log(`✅ Database '${process.env.DB_NAME}' created/verified`);

        // Use the database
        await connection.query(`USE ${process.env.DB_NAME}`);

        // Create Users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created');

        // Create Subscription Plans table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name ENUM('free', 'basic', 'premium') UNIQUE NOT NULL,
                price DECIMAL(10, 2) DEFAULT 0,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Subscription Plans table created');

        // Create Movies table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS movies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                genre VARCHAR(100),
                release_year INT,
                rating DECIMAL(3, 1) DEFAULT 0,
                video_url VARCHAR(500),
                poster_url VARCHAR(500),
                subscription_required ENUM('free', 'basic', 'premium') DEFAULT 'free',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Movies table created');

        // Create Music table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS music (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255),
                genre VARCHAR(100),
                audio_url VARCHAR(500),
                poster_url VARCHAR(500),
                subscription_required ENUM('free', 'basic', 'premium') DEFAULT 'free',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Music table created');

        // Create Reviews table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                movie_id INT,
                rating INT CHECK (rating >= 1 AND rating <= 5),
                review_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Reviews table created');

        // Create User Subscriptions table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                plan_id INT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
                payment_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ User Subscriptions table created');

        // Create Watch History table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS watch_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                movie_id INT,
                music_id INT,
                watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
                FOREIGN KEY (music_id) REFERENCES music(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Watch History table created');

        // Insert default subscription plans
        await connection.query(`
            INSERT IGNORE INTO subscription_plans (id, name, price, description) VALUES
            (1, 'free', 0.00, 'Limited content access'),
            (2, 'basic', 9.99, 'Access to selected movies and music'),
            (3, 'premium', 19.99, 'Unlimited access to all content')
        `);
        console.log('✅ Default subscription plans inserted');

        // Create default admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await connection.query(`
            INSERT IGNORE INTO users (name, email, password, role) VALUES
            ('Admin', 'admin@reelvibe.com', ?, 'admin')
        `, [adminPassword]);
        console.log('✅ Default admin user created (admin@reelvibe.com / admin123)');

        // Assign free subscription to admin
        await connection.query(`
            INSERT IGNORE INTO user_subscriptions (user_id, plan_id, start_date, status)
            SELECT id, 1, CURDATE(), 'active' FROM users WHERE email = 'admin@reelvibe.com'
            AND NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = users.id)
        `);

        // Insert sample movies
        await connection.query(`
            INSERT IGNORE INTO movies (id, title, description, genre, release_year, rating, video_url, poster_url, subscription_required) VALUES
            (1, 'The Adventure Begins', 'An epic journey of discovery and courage', 'Action', 2024, 8.5, '/uploads/sample-video.mp4', '/uploads/poster1.jpg', 'free'),
            (2, 'Mystery Island', 'A thrilling mystery set on a remote island', 'Thriller', 2023, 7.8, '/uploads/sample-video.mp4', '/uploads/poster2.jpg', 'basic'),
            (3, 'Space Odyssey', 'A breathtaking journey through the cosmos', 'Sci-Fi', 2024, 9.2, '/uploads/sample-video.mp4', '/uploads/poster3.jpg', 'premium'),
            (4, 'The Last Stand', 'A hero making their final stand', 'Drama', 2023, 8.0, '/uploads/sample-video.mp4', '/uploads/poster4.jpg', 'free'),
            (5, 'Comedy Central', 'The funniest movie of the year', 'Comedy', 2024, 7.5, '/uploads/sample-video.mp4', '/uploads/poster5.jpg', 'basic')
        `);
        console.log('✅ Sample movies inserted');

        // Insert sample music
        await connection.query(`
            INSERT IGNORE INTO music (id, title, artist, genre, audio_url, poster_url, subscription_required) VALUES
            (1, 'Summer Vibes', 'DJ Sunset', 'Electronic', '/uploads/sample-audio.mp3', '/uploads/music1.jpg', 'free'),
            (2, 'Rock Anthem', 'The Rockers', 'Rock', '/uploads/sample-audio.mp3', '/uploads/music2.jpg', 'basic'),
            (3, 'Classical Dreams', 'Orchestra Masters', 'Classical', '/uploads/sample-audio.mp3', '/uploads/music3.jpg', 'premium'),
            (4, 'Jazz Night', 'Smooth Jazz Band', 'Jazz', '/uploads/sample-audio.mp3', '/uploads/music4.jpg', 'free'),
            (5, 'Pop Hits', 'Pop Stars', 'Pop', '/uploads/sample-audio.mp3', '/uploads/music5.jpg', 'basic')
        `);
        console.log('✅ Sample music inserted');

        console.log('\n🎉 Database initialization completed successfully!\n');

    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run if executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = initializeDatabase;
