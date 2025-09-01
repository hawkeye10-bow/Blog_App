import mongoose from "mongoose";
import bcrypt from 'bcryptjs';
import User from "./model/User.js";

const createAdminUser = async () => {
  try {
    // Connect to database
    await mongoose.connect("mongodb+srv://sandeepdara44:1234567890@cluster0.5z3d3z6.mongodb.net/blogapp?retryWrites=true&w=majority&appName=Cluster0", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Database connected successfully");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@bloggy.com' });
    if (existingAdmin) {
      console.log("ℹ️ Admin user already exists");
      console.log("Email: admin@bloggy.com");
      console.log("Password: admin123");
      console.log("Role: admin");
      return;
    }

    // Create admin user
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@bloggy.com',
      password: hashedPassword,
      role: 'admin',
      blogs: [],
      bookmarks: [],
      following: [],
      followers: [],
      notifications: [],
      isActive: true,
      emailVerified: true,
      createdAt: new Date(),
      lastActive: new Date()
    });

    await adminUser.save();
    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: admin@bloggy.com");
    console.log("🔑 Password: admin123");
    console.log("👑 Role: admin");
    console.log("🚀 You can now login with these credentials");

  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
};

createAdminUser();
