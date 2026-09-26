-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 20, 2026 at 12:26 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `scam_detector`
--

-- --------------------------------------------------------

--
-- Table structure for table `scamreports`
--

CREATE TABLE `scamreports` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` longtext NOT NULL,
  `source_url` text DEFAULT NULL,
  `scam_score` int(11) DEFAULT 0,
  `image` varchar(255) DEFAULT NULL,
  `status` enum('pending','verified','rejected') DEFAULT 'pending',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `scanhistories`
--

CREATE TABLE `scanhistories` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  `content` varchar(255) DEFAULT NULL,
  `scam_score` int(11) DEFAULT NULL,
  `verdict` varchar(255) DEFAULT NULL,
  `ai_response` longtext DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `file_hash` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `scanhistories`
--

INSERT INTO `scanhistories` (`id`, `user_id`, `type`, `content`, `scam_score`, `verdict`, `ai_response`, `createdAt`, `updatedAt`, `file_hash`) VALUES
(1, 1, 'image', '8f68002c2944e73b24a661b20820dd03aa19ff25d9725bc98264d7f996abcbd8', 95, 'This is highly likely a job recruitment scam attempting to impersonate Pakistan Post. Key indicators include the advertisement of jobs for a distant future year (2026) and directing applicants to an unofficial third-party website (\"jobsraabta.com\") which ', '{\"summary\":\"The content is an advertisement for \\\"Pakistan Post Jobs 2026\\\", claiming to be from the Government of Pakistan. It lists various positions and benefits, instructing applicants to visit \\\"jobsraabta.com\\\" to apply.\",\"scam_score\":95,\"risk_level\":\"HIGH\",\"verdict\":\"This is highly likely a job recruitment scam attempting to impersonate Pakistan Post. Key indicators include the advertisement of jobs for a distant future year (2026) and directing applicants to an unofficial third-party website (\\\"jobsraabta.com\\\") which is not a government domain. The instruction \\\"Guarant poster\\\" also suggests unprofessionalism.\",\"confidence\":0.95,\"red_flags\":[\"Advertisement for jobs in 2026 (two years in the future from current year assumed to be 2024), which is highly unusual for government recruitment.\",\"Directs applicants to a third-party domain, \\\"jobsraabta.com\\\", which is not an official Pakistan government website (official domains typically end in .gov.pk).\",\"Vague and generic promises like \\\"ATTRACTIVE SALARY\\\" and \\\"Medical Facilities\\\" without specific details.\",\"Grammatical error and nonsensical instruction \\\"Guarant poster\\\" in the application steps, indicating unprofessionalism.\",\"Impersonation of a government department (Pakistan Post) to lure job seekers.\"],\"positive_signals\":[],\"recommendations\":[\"Do not visit \\\"jobsraabta.com\\\" or enter any personal information on this site.\",\"Do not pay any application, processing, or training fees, as legitimate government jobs rarely require such payments upfront.\",\"Always verify job postings directly on the official website of the respective government department (e.g., Pakistan Post\'s official .gov.pk website) or through verified government job portals.\",\"Be extremely cautious of job advertisements promising positions far in the future or directing to non-official domains.\"],\"final_decision\":{\"safe_to_use\":false,\"safe_to_apply_job\":false,\"safe_to_invest\":false,\"safe_to_download\":false},\"url_analysis\":{\"url\":\"jobsraabta.com\",\"is_official_domain\":false,\"domain_suffix\":\".com\",\"potential_phishing\":true,\"threat_assessment\":\"High risk - likely a phishing/scam website designed to collect personal data or money.\"},\"domain_analysis\":{\"domain\":\"jobsraabta.com\",\"registration_date_known\":false,\"registrar_info_known\":false,\"suspicious_keywords\":[\"jobs\",\"raabta\"],\"geographical_indicators\":\"Unknown\",\"reputation_score\":\"Very Low\"}}', '2026-06-20 10:23:14', '2026-06-20 10:23:14', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('user','admin') DEFAULT 'user',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `role`, `createdAt`, `updatedAt`) VALUES
(1, 'Shakeel Aptech', 'shakeelaptech43@gmail.com', '$2b$10$mBSdCCni8l96lHkkDjblyeG8tJ0A889Vt1qeuXG3Rbpq0uxCrbcxe', 'user', '2026-06-13 09:46:32', '2026-06-13 09:46:32');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `scamreports`
--
ALTER TABLE `scamreports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `scanhistories`
--
ALTER TABLE `scanhistories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_scan_cache` (`type`,`content`,`createdAt`),
  ADD KEY `idx_user_history` (`user_id`),
  ADD KEY `idx_file_hash` (`type`,`file_hash`,`createdAt`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD UNIQUE KEY `email_3` (`email`),
  ADD UNIQUE KEY `email_4` (`email`),
  ADD UNIQUE KEY `email_5` (`email`),
  ADD UNIQUE KEY `email_6` (`email`),
  ADD UNIQUE KEY `email_7` (`email`),
  ADD UNIQUE KEY `email_8` (`email`),
  ADD UNIQUE KEY `email_9` (`email`),
  ADD UNIQUE KEY `email_10` (`email`),
  ADD UNIQUE KEY `email_11` (`email`),
  ADD UNIQUE KEY `email_12` (`email`),
  ADD UNIQUE KEY `email_13` (`email`),
  ADD UNIQUE KEY `email_14` (`email`),
  ADD UNIQUE KEY `email_15` (`email`),
  ADD UNIQUE KEY `email_16` (`email`),
  ADD UNIQUE KEY `email_17` (`email`),
  ADD UNIQUE KEY `email_18` (`email`),
  ADD UNIQUE KEY `email_19` (`email`),
  ADD UNIQUE KEY `email_20` (`email`),
  ADD UNIQUE KEY `email_21` (`email`),
  ADD UNIQUE KEY `email_22` (`email`),
  ADD UNIQUE KEY `email_23` (`email`),
  ADD UNIQUE KEY `email_24` (`email`),
  ADD UNIQUE KEY `email_25` (`email`),
  ADD UNIQUE KEY `email_26` (`email`),
  ADD UNIQUE KEY `email_27` (`email`),
  ADD UNIQUE KEY `email_28` (`email`),
  ADD UNIQUE KEY `email_29` (`email`),
  ADD UNIQUE KEY `email_30` (`email`),
  ADD UNIQUE KEY `email_31` (`email`),
  ADD UNIQUE KEY `email_32` (`email`),
  ADD UNIQUE KEY `email_33` (`email`),
  ADD UNIQUE KEY `email_34` (`email`),
  ADD UNIQUE KEY `email_35` (`email`),
  ADD UNIQUE KEY `email_36` (`email`),
  ADD UNIQUE KEY `email_37` (`email`),
  ADD UNIQUE KEY `email_38` (`email`),
  ADD UNIQUE KEY `email_39` (`email`),
  ADD UNIQUE KEY `email_40` (`email`),
  ADD UNIQUE KEY `email_41` (`email`),
  ADD UNIQUE KEY `email_42` (`email`),
  ADD UNIQUE KEY `email_43` (`email`),
  ADD UNIQUE KEY `email_44` (`email`),
  ADD UNIQUE KEY `email_45` (`email`),
  ADD UNIQUE KEY `email_46` (`email`),
  ADD UNIQUE KEY `email_47` (`email`),
  ADD UNIQUE KEY `email_48` (`email`),
  ADD UNIQUE KEY `email_49` (`email`),
  ADD UNIQUE KEY `email_50` (`email`),
  ADD UNIQUE KEY `email_51` (`email`),
  ADD UNIQUE KEY `email_52` (`email`),
  ADD UNIQUE KEY `email_53` (`email`),
  ADD UNIQUE KEY `email_54` (`email`),
  ADD UNIQUE KEY `email_55` (`email`),
  ADD UNIQUE KEY `email_56` (`email`),
  ADD UNIQUE KEY `email_57` (`email`),
  ADD UNIQUE KEY `email_58` (`email`),
  ADD UNIQUE KEY `email_59` (`email`),
  ADD UNIQUE KEY `email_60` (`email`),
  ADD UNIQUE KEY `email_61` (`email`),
  ADD UNIQUE KEY `email_62` (`email`),
  ADD UNIQUE KEY `email_63` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `scamreports`
--
ALTER TABLE `scamreports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `scanhistories`
--
ALTER TABLE `scanhistories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
