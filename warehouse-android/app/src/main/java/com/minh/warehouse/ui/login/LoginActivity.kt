package com.minh.warehouse.ui.login

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import com.minh.warehouse.R
import com.minh.warehouse.ui.main.MainActivity
import com.minh.warehouse.util.TokenManager
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var viewModel: LoginViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Nếu đã có token → vào thẳng MainActivity
        lifecycleScope.launch {
            val token = TokenManager.get(this@LoginActivity)
            if (!token.isNullOrEmpty()) {
                goToMain()
                return@launch
            }
            showLoginUI()
        }
    }

    private fun showLoginUI() {
        setContentView(R.layout.activity_login)
        viewModel = ViewModelProvider(this)[LoginViewModel::class.java]

        val etUsername = findViewById<EditText>(R.id.etUsername)
        val etPassword = findViewById<EditText>(R.id.etPassword)
        val btnLogin   = findViewById<Button>(R.id.btnLogin)
        val tvError    = findViewById<TextView>(R.id.tvError)

        btnLogin.setOnClickListener {
            val username = etUsername.text.toString().trim()
            val password = etPassword.text.toString().trim()
            if (username.isEmpty() || password.isEmpty()) {
                tvError.text = "Vui lòng nhập đủ thông tin"
                return@setOnClickListener
            }
            viewModel.login(username, password)
        }

        viewModel.loginState.observe(this) { state ->
            when (state) {
                is LoginState.Loading -> btnLogin.isEnabled = false
                is LoginState.Success -> {
                    lifecycleScope.launch {
                        TokenManager.save(this@LoginActivity, state.token)
                        goToMain()
                    }
                }
                is LoginState.Error -> {
                    btnLogin.isEnabled = true
                    tvError.text = state.message
                }
            }
        }
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}