/**
 * Database Seed Script
 * Create initial admin user and sample data
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...\n');

    // ===== CREATE ADMIN USER =====
    const adminPassword = await bcrypt.hash('admin123', 12);

    const admin = await prisma.staff.upsert({
        where: { email: 'admin@weaccounting.local' },
        update: {},
        create: {
            email: 'admin@weaccounting.local',
            password_hash: adminPassword,
            name: 'System Admin',
            role: 'admin',
            assigned_clients: [],
        },
    });
    console.log('✅ Admin user created:', admin.email);

    // ===== CREATE DEMO ACCOUNTANT =====
    const accountantPassword = await bcrypt.hash('demo123', 12);

    const accountant = await prisma.staff.upsert({
        where: { email: 'accountant@weaccounting.local' },
        update: {},
        create: {
            email: 'accountant@weaccounting.local',
            password_hash: accountantPassword,
            name: 'Demo Accountant',
            role: 'accountant',
            assigned_clients: [],
        },
    });
    console.log('✅ Demo accountant created:', accountant.email);

    // ===== CREATE SAMPLE CLIENTS =====
    const clients = [
        {
            name: 'บริษัท ตัวอย่าง จำกัด',
            tax_id: '0105555000001',
            address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
            phone: '02-123-4567',
            email: 'contact@example.co.th',
            contact_person: 'คุณสมชาย',
            business_type: 'Trading',
            vat_registered: true,
        },
        {
            name: 'ห้างหุ้นส่วนจำกัด เดโม',
            tax_id: '0105555000002',
            address: '456 ถนนพระราม 9 กรุงเทพฯ 10320',
            phone: '02-234-5678',
            email: 'info@demo.co.th',
            contact_person: 'คุณสมหญิง',
            business_type: 'Service',
            vat_registered: true,
        },
        {
            name: 'บริษัท เทสต์ เซอร์วิส จำกัด',
            tax_id: '0105555000003',
            address: '789 ถนนสีลม กรุงเทพฯ 10500',
            phone: '02-345-6789',
            email: 'test@service.co.th',
            contact_person: 'คุณทดสอบ',
            business_type: 'Professional Service',
            vat_registered: false,
        },
    ];

    for (const clientData of clients) {
        const client = await prisma.client.upsert({
            where: { tax_id: clientData.tax_id },
            update: {},
            create: clientData,
        });
        console.log('✅ Client created:', client.name);
    }

    // ===== CREATE GLOBAL VENDOR RULES =====
    const vendorRules = [
        {
            vendor_pattern: 'ไปรษณีย์',
            default_account: '52500',
            default_doc_type: 'expense',
            wht_rate: 0,
            description: 'ค่าไปรษณีย์/ค่าส่ง',
        },
        {
            vendor_pattern: 'การไฟฟ้า|MEA|PEA',
            default_account: '52100',
            default_doc_type: 'expense',
            wht_rate: 0,
            description: 'ค่าไฟฟ้า',
        },
        {
            vendor_pattern: 'ประปา|MWA|PWA',
            default_account: '52200',
            default_doc_type: 'expense',
            wht_rate: 0,
            description: 'ค่าน้ำประปา',
        },
        {
            vendor_pattern: 'เช่า|RENT|lease',
            default_account: '52400',
            default_doc_type: 'expense',
            wht_rate: 5,
            description: 'ค่าเช่า (หัก ณ ที่จ่าย 5%)',
        },
        {
            vendor_pattern: 'ที่ปรึกษา|consultant',
            default_account: '52800',
            default_doc_type: 'expense',
            wht_rate: 3,
            description: 'ค่าที่ปรึกษา/วิชาชีพ (หัก ณ ที่จ่าย 3%)',
        },
        {
            vendor_pattern: 'โฆษณา|advertising|ads',
            default_account: '52700',
            default_doc_type: 'expense',
            wht_rate: 2,
            description: 'ค่าโฆษณา (หัก ณ ที่จ่าย 2%)',
        },
        {
            vendor_pattern: 'ขนส่ง|transport|shipping',
            default_account: '52600',
            default_doc_type: 'expense',
            wht_rate: 1,
            description: 'ค่าขนส่ง (หัก ณ ที่จ่าย 1%)',
        },
    ];

    for (const rule of vendorRules) {
        await prisma.vendorRule.upsert({
            where: { id: `seed-${rule.vendor_pattern.slice(0, 10)}` },
            update: {},
            create: {
                client_id: null, // Global rule
                ...rule,
            },
        });
    }
    console.log(`✅ ${vendorRules.length} vendor rules created`);

    // ===== UPDATE ACCOUNTANT ASSIGNED CLIENTS =====
    const allClients = await prisma.client.findMany();
    await prisma.staff.update({
        where: { id: accountant.id },
        data: {
            assigned_clients: allClients.map(c => c.id),
        },
    });
    console.log('✅ Assigned all clients to demo accountant');

    console.log('\n✨ Seed completed successfully!\n');
    console.log('═══════════════════════════════════════════');
    console.log('  Login Credentials:');
    console.log('═══════════════════════════════════════════');
    console.log('  Admin:');
    console.log('    Email: admin@weaccounting.local');
    console.log('    Password: admin123');
    console.log('');
    console.log('  Demo Accountant:');
    console.log('    Email: accountant@weaccounting.local');
    console.log('    Password: demo123');
    console.log('═══════════════════════════════════════════\n');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Seed error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
