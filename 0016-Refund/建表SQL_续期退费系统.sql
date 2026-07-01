-- =====================================================
-- 续期退费系统数据库建表SQL (MySQL 8.0+)
-- 创建时间: 2026-07-01
-- 执行顺序: 按表依赖关系依次执行
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 角色表（无外键依赖，先创建）
CREATE TABLE IF NOT EXISTS `role` (
  `role_id` varchar(10) NOT NULL COMMENT '角色ID',
  `role_name` varchar(50) NOT NULL COMMENT '角色名称',
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 2. 权限表（无外键依赖）
CREATE TABLE IF NOT EXISTS `permission` (
  `perm_id` varchar(10) NOT NULL COMMENT '权限ID',
  `perm_name` varchar(100) NOT NULL COMMENT '权限名称',
  PRIMARY KEY (`perm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表';

-- 3. 分公司表（无外键依赖）
CREATE TABLE IF NOT EXISTS `branch` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `branch_name` varchar(50) NOT NULL COMMENT '分公司名称',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branch_name` (`branch_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分公司表';

-- 4. 保单表（依赖 branch）
CREATE TABLE IF NOT EXISTS `policy` (
  `policy_no` varchar(20) NOT NULL COMMENT '保单号',
  `holder_name` varchar(100) NOT NULL COMMENT '投保人姓名',
  `holder_id` varchar(18) NOT NULL COMMENT '身份证号',
  `holder_id_masked` varchar(20) DEFAULT NULL COMMENT '身份证脱敏',
  `phone` varchar(11) NOT NULL COMMENT '手机号',
  `phone_masked` varchar(15) DEFAULT NULL COMMENT '手机脱敏',
  `main_risk` varchar(100) DEFAULT NULL COMMENT '主险名称',
  `risk_code` varchar(20) DEFAULT NULL COMMENT '险种代码',
  `status` varchar(20) DEFAULT NULL COMMENT '保单状态',
  `start_date` date DEFAULT NULL COMMENT '责任起期',
  `end_date` date DEFAULT NULL COMMENT '责任止期',
  `next_pay_date` date DEFAULT NULL COMMENT '下次缴费日期',
  `pay_method` varchar(20) DEFAULT NULL COMMENT '缴费方式',
  `branch` varchar(50) DEFAULT NULL COMMENT '分公司',
  `sub_branch` varchar(50) DEFAULT NULL COMMENT '中支',
  `address` varchar(200) DEFAULT NULL COMMENT '地址',
  `account_name` varchar(100) DEFAULT NULL COMMENT '账户名',
  `bank_account` varchar(30) DEFAULT NULL COMMENT '银行账号',
  `bank_name` varchar(50) DEFAULT NULL COMMENT '开户行',
  `total_premium` decimal(12,2) DEFAULT NULL COMMENT '总保费',
  `sales_channel` varchar(20) DEFAULT NULL COMMENT '销售渠道',
  `sub_channel` varchar(10) DEFAULT NULL COMMENT '子渠道',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`policy_no`),
  KEY `idx_holder_id` (`holder_id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_branch` (`branch`,`sub_branch`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保单表';

-- 5. 所属机构表（依赖 branch）
CREATE TABLE IF NOT EXISTS `branch_inst` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `branch_name` varchar(50) NOT NULL COMMENT '分公司名称',
  `inst_name` varchar(50) NOT NULL COMMENT '机构名称',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branch_inst` (`branch_name`,`inst_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='所属机构表';

-- 6. 用户表（依赖 role、branch）
CREATE TABLE IF NOT EXISTS `user` (
  `user_id` varchar(20) NOT NULL COMMENT '用户ID',
  `user_name` varchar(50) NOT NULL COMMENT '用户姓名',
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password_hash` varchar(255) NOT NULL COMMENT '密码哈希',
  `role_id` varchar(10) DEFAULT NULL COMMENT '主要角色ID',
  `branch` varchar(50) DEFAULT NULL COMMENT '所属分公司',
  `status` tinyint(1) DEFAULT '1' COMMENT '状态',
  `last_login` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 7. 缴费记录表（依赖 policy）
CREATE TABLE IF NOT EXISTS `payment` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `policy_no` varchar(20) NOT NULL COMMENT '保单号',
  `period` int NOT NULL COMMENT '期次',
  `amount` decimal(12,2) NOT NULL COMMENT '金额',
  `should_pay_date` date NOT NULL COMMENT '应缴日期',
  `actual_pay_date` date DEFAULT NULL COMMENT '实缴日期',
  `source` varchar(20) DEFAULT NULL COMMENT '来源',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_policy_no` (`policy_no`),
  KEY `idx_should_pay_date` (`should_pay_date`),
  CONSTRAINT `fk_payment_policy` FOREIGN KEY (`policy_no`) REFERENCES `policy` (`policy_no`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='缴费记录表';

-- 8. 自然人信息表（依赖 policy）
CREATE TABLE IF NOT EXISTS `natural_person` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `policy_no` varchar(20) NOT NULL COMMENT '保单号',
  `name` varchar(100) NOT NULL COMMENT '姓名',
  `gender` varchar(2) DEFAULT NULL COMMENT '性别',
  `nationality` varchar(20) DEFAULT NULL COMMENT '国籍',
  `occupation` varchar(50) DEFAULT NULL COMMENT '职业',
  `address` varchar(200) DEFAULT NULL COMMENT '地址',
  `contact` varchar(20) DEFAULT NULL COMMENT '联系方式',
  `id_type` varchar(20) DEFAULT NULL COMMENT '身份证件种类',
  `id_number` varchar(18) DEFAULT NULL COMMENT '身份证件号码',
  `valid_until` date DEFAULT NULL COMMENT '有效期限',
  `follow_wechat` tinyint(1) DEFAULT '0' COMMENT '是否关注太平洋寿险官微',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_policy_no` (`policy_no`),
  CONSTRAINT `fk_natural_person_policy` FOREIGN KEY (`policy_no`) REFERENCES `policy` (`policy_no`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自然人信息表';

-- 9. 场景规则表（依赖 policy）
CREATE TABLE IF NOT EXISTS `scenario` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `policy_no` varchar(20) NOT NULL COMMENT '保单号',
  `has_claim_after_due` tinyint(1) DEFAULT '0' COMMENT '应缴日后有理赔',
  `has_surrender_after_due` tinyint(1) DEFAULT '0' COMMENT '应缴日后有减保',
  `has_holder_change` tinyint(1) DEFAULT '0' COMMENT '已做投保人变更',
  `has_unpaid_loan` tinyint(1) DEFAULT '0' COMMENT '存在未结清贷款',
  `commission_payable` tinyint(1) DEFAULT '0' COMMENT '是否发放续期佣金',
  `advance_payment_refund` tinyint(1) DEFAULT '0' COMMENT '是否垫缴退费',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_policy_no` (`policy_no`),
  CONSTRAINT `fk_scenario_policy` FOREIGN KEY (`policy_no`) REFERENCES `policy` (`policy_no`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场景规则表';

-- 10. 退费记录表（依赖 policy）
CREATE TABLE IF NOT EXISTS `refund` (
  `id` varchar(20) NOT NULL COMMENT '退费ID',
  `policy_no` varchar(20) NOT NULL COMMENT '保单号',
  `holder_name` varchar(100) NOT NULL COMMENT '投保人姓名',
  `holder_id` varchar(18) NOT NULL COMMENT '身份证号',
  `phone` varchar(11) NOT NULL COMMENT '手机号',
  `amount` decimal(12,2) NOT NULL COMMENT '退费金额',
  `status` int NOT NULL COMMENT '状态',
  `status_name` varchar(50) DEFAULT NULL COMMENT '状态名称',
  `accept_channel` varchar(20) DEFAULT NULL COMMENT '受理渠道',
  `accept_time` datetime DEFAULT NULL COMMENT '受理时间',
  `acceptor` varchar(50) DEFAULT NULL COMMENT '受理人',
  `refund_periods` varchar(100) DEFAULT NULL COMMENT '退费期次',
  `refund_reason` varchar(200) DEFAULT NULL COMMENT '退费原因',
  `is_auto_approval` tinyint(1) DEFAULT '0' COMMENT '是否自动审批',
  `is_original_card` tinyint(1) DEFAULT '1' COMMENT '是否原卡原退',
  `material_deadline` datetime DEFAULT NULL COMMENT '材料补充截止时间',
  `failure_reason` varchar(200) DEFAULT NULL COMMENT '失败原因',
  `sales_channel` varchar(20) DEFAULT NULL COMMENT '销售渠道',
  `sub_channel` varchar(10) DEFAULT NULL COMMENT '子渠道',
  `branch` varchar(50) DEFAULT NULL COMMENT '分公司',
  `sub_branch` varchar(50) DEFAULT NULL COMMENT '所属机构',
  `bank_account` varchar(30) DEFAULT NULL COMMENT '银行卡号',
  `bank_name` varchar(50) DEFAULT NULL COMMENT '开户行',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_policy_no` (`policy_no`),
  KEY `idx_holder_id` (`holder_id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_status` (`status`),
  KEY `idx_accept_time` (`accept_time`),
  KEY `idx_branch` (`branch`,`sub_branch`),
  CONSTRAINT `fk_refund_policy` FOREIGN KEY (`policy_no`) REFERENCES `policy` (`policy_no`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退费记录表';

-- 11. 审批节点表（依赖 refund、user）
CREATE TABLE IF NOT EXISTS `approval_node` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `refund_id` varchar(20) NOT NULL COMMENT '退费ID',
  `node_name` varchar(100) NOT NULL COMMENT '节点名称',
  `node_order` int NOT NULL COMMENT '节点顺序',
  `status` varchar(20) DEFAULT 'pending' COMMENT '状态',
  `operator` varchar(50) DEFAULT NULL COMMENT '操作人姓名',
  `operator_id` varchar(20) DEFAULT NULL COMMENT '操作人ID',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `comment` varchar(500) DEFAULT NULL COMMENT '审批意见',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_refund_id` (`refund_id`),
  KEY `idx_operator_id` (`operator_id`),
  CONSTRAINT `fk_approval_node_refund` FOREIGN KEY (`refund_id`) REFERENCES `refund` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批节点表';

-- 12. 操作日志表（依赖 refund）
CREATE TABLE IF NOT EXISTS `refund_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `refund_id` varchar(20) NOT NULL COMMENT '退费ID',
  `time` datetime NOT NULL COMMENT '操作时间',
  `action` varchar(50) NOT NULL COMMENT '操作动作',
  `operator` varchar(50) NOT NULL COMMENT '操作人',
  `detail` varchar(500) DEFAULT NULL COMMENT '操作详情',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_refund_id` (`refund_id`),
  KEY `idx_time` (`time`),
  CONSTRAINT `fk_refund_log_refund` FOREIGN KEY (`refund_id`) REFERENCES `refund` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 13. 用户角色关联表（依赖 user、role）
CREATE TABLE IF NOT EXISTS `user_role` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `user_id` varchar(20) NOT NULL COMMENT '用户ID',
  `role_id` varchar(10) NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`,`role_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `fk_user_role_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

-- 14. 角色权限关联表（依赖 role、permission）
CREATE TABLE IF NOT EXISTS `role_permission` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `role_id` varchar(10) NOT NULL COMMENT '角色ID',
  `perm_id` varchar(10) NOT NULL COMMENT '权限ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_perm` (`role_id`,`perm_id`),
  KEY `idx_perm_id` (`perm_id`),
  CONSTRAINT `fk_role_perm_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_perm_perm` FOREIGN KEY (`perm_id`) REFERENCES `permission` (`perm_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表';

-- 15. 短信记录表（依赖 refund）
CREATE TABLE IF NOT EXISTS `sms_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `refund_id` varchar(20) NOT NULL COMMENT '退费ID',
  `phone` varchar(11) NOT NULL COMMENT '接收手机号',
  `content` varchar(500) NOT NULL COMMENT '短信内容',
  `category` varchar(20) DEFAULT NULL COMMENT '类别',
  `send_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `status` varchar(20) DEFAULT 'sent' COMMENT '状态',
  PRIMARY KEY (`id`),
  KEY `idx_refund_id` (`refund_id`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短信记录表';

-- 16. 微信记录表（依赖 refund）
CREATE TABLE IF NOT EXISTS `wechat_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `refund_id` varchar(20) NOT NULL COMMENT '退费ID',
  `wechat_id` varchar(100) DEFAULT NULL COMMENT '微信OpenID',
  `content` varchar(500) NOT NULL COMMENT '微信内容',
  `category` varchar(20) DEFAULT NULL COMMENT '类别',
  `send_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `status` varchar(20) DEFAULT 'sent' COMMENT '状态',
  PRIMARY KEY (`id`),
  KEY `idx_refund_id` (`refund_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信记录表';

-- 17. 审批流配置表（无外键依赖）
CREATE TABLE IF NOT EXISTS `approval_flow_config` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `config_key` varchar(100) NOT NULL COMMENT '配置键',
  `config_value` json NOT NULL COMMENT '配置值',
  `config_type` varchar(20) NOT NULL COMMENT '配置类型',
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批流配置表';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入角色数据
INSERT INTO `role` (`role_id`, `role_name`) VALUES
('J1', '客户'),
('J2', '95500坐席'),
('J3', '柜员'),
('J4', '业务内勤'),
('J5', '审批人'),
('J6', '业务管理-分渠道'),
('J7', '业务管理-全渠道'),
('J8', 'Admin')
ON DUPLICATE KEY UPDATE `role_name`=VALUES(`role_name`);

-- 插入权限数据
INSERT INTO `permission` (`perm_id`, `perm_name`) VALUES
('Q1', '续期退费受理'),
('Q2', '续期退费查询和统计'),
('Q3', '续期退费审批'),
('Q4', '续期退费补充材料确认'),
('Q5', '续期退费失败件处理'),
('Q6', '续期退费进度查询（移动端）'),
('Q7', '续期退费补充材料（移动端）'),
('Q8', '续期退费运维'),
('Q9', '审批流管理')
ON DUPLICATE KEY UPDATE `perm_name`=VALUES(`perm_name`);

-- 插入角色权限关联数据
INSERT INTO `role_permission` (`role_id`, `perm_id`) VALUES
('J1', 'Q6'),
('J1', 'Q7'),
('J2', 'Q1'),
('J2', 'Q2'),
('J4', 'Q2'),
('J4', 'Q3'),
('J4', 'Q4'),
('J4', 'Q5'),
('J4', 'Q9'),
('J5', 'Q3'),
('J6', 'Q2'),
('J7', 'Q2'),
('J8', 'Q1'),
('J8', 'Q2'),
('J8', 'Q3'),
('J8', 'Q4'),
('J8', 'Q5'),
('J8', 'Q6'),
('J8', 'Q7'),
('J8', 'Q8'),
('J8', 'Q9')
ON DUPLICATE KEY UPDATE `role_id`=VALUES(`role_id`);

-- 插入分公司数据
INSERT INTO `branch` (`branch_name`) VALUES
('上海分公司'),
('北京分公司'),
('广东分公司'),
('深圳分公司'),
('四川分公司'),
('湖北分公司'),
('浙江分公司'),
('江苏分公司'),
('陕西分公司'),
('山西分公司'),
('常州分公司'),
('苏州分公司'),
('大连分公司'),
('黑龙江分公司'),
('无锡分公司'),
('天津分公司'),
('辽宁分公司'),
('吉林省分公司'),
('河北分公司'),
('内蒙古分公司'),
('海南分公司'),
('宁波分公司'),
('湖南分公司'),
('宁夏分公司'),
('重庆分公司'),
('江西分公司'),
('厦门分公司'),
('福建分公司'),
('甘肃分公司'),
('贵州分公司'),
('新疆分公司'),
('安徽分公司'),
('青海分公司'),
('青岛分公司'),
('山东分公司'),
('云南分公司'),
('广西分公司'),
('河南分公司')
ON DUPLICATE KEY UPDATE `branch_name`=VALUES(`branch_name`);

-- 插入所属机构数据
INSERT INTO `branch_inst` (`branch_name`, `inst_name`) VALUES
('上海分公司', '-'),
('北京分公司', '-'),
('广东分公司', '广州中支'),
('深圳分公司', '-'),
('四川分公司', '成都中支'),
('湖北分公司', '武汉中支'),
('浙江分公司', '杭州中支')
ON DUPLICATE KEY UPDATE `inst_name`=VALUES(`inst_name`);

COMMIT;
